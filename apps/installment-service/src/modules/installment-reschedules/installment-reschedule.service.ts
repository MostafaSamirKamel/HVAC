import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  InstallmentSettledEarlyEvent,
  InstallmentRescheduledEvent,
} from '@hvac/event-contracts';
import {
  InstallmentRescheduleModel,
  IInstallmentReschedule,
} from './installment-reschedule.model.js';
import {
  InstallmentContractModel,
  IInstallmentContract,
} from '../installment-contracts/installment-contract.model.js';
import {
  InstallmentScheduleModel,
  IInstallmentSchedule,
} from '../installment-schedules/installment-schedule.model.js';

export interface EarlySettlementCalculation {
  contractId: string;
  totalUnpaidPrincipal: number;
  totalUnpaidInterest: number;
  waivedInterest: number;
  netSettlementAmount: number;
  currency: string;
}

export interface ExecuteEarlySettlementInput {
  companyId: string;
  contractId: string;
  waiveInterestPercentage?: number; // default 100% of future unearned interest
  receiptId?: string;
  reason: string;
  requestedBy: string;
  approvedBy: string;
}

export interface RescheduleTenorInput {
  companyId: string;
  contractId: string;
  newAdditionalMonths: number;
  newAnnualInterestRate?: number;
  reason: string;
  requestedBy: string;
  approvedBy: string;
}

export class InstallmentRescheduleService {
  public static async calculateEarlySettlement(
    companyId: string,
    contractId: string,
    waiveInterestPercentage: number = 100,
    session?: ClientSession
  ): Promise<EarlySettlementCalculation> {
    const query = InstallmentContractModel.findOne({ companyId, contractId });
    const contract = session ? await query.session(session) : await query;
    if (!contract) {
      throw new NotFoundError(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'ACTIVE') {
      throw new ValidationError(`Contract status is '${contract.status}', must be 'ACTIVE'`);
    }

    const unpaidQuery = InstallmentScheduleModel.find({
      companyId,
      contractId,
      status: { $in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
    });
    const unpaidSchedules = session ? await unpaidQuery.session(session) : await unpaidQuery;

    const currency = contract.currency;
    let totalUnpaidPrincipal = Money.from(0, currency);
    let totalUnpaidInterest = Money.from(0, currency);

    for (const s of unpaidSchedules) {
      const pRem = Money.from(s.principalAmount.toString(), currency);
      const iRem = Money.from(s.interestAmount.toString(), currency);
      totalUnpaidPrincipal = totalUnpaidPrincipal.add(pRem);
      totalUnpaidInterest = totalUnpaidInterest.add(iRem);
    }

    const waiveRatio = Math.max(0, Math.min(100, waiveInterestPercentage)) / 100;
    const waivedInterest = totalUnpaidInterest.multiply(waiveRatio);
    const netInterest = totalUnpaidInterest.subtract(waivedInterest);
    const netSettlementAmount = totalUnpaidPrincipal.add(netInterest);

    return {
      contractId,
      totalUnpaidPrincipal: totalUnpaidPrincipal.toNumber(),
      totalUnpaidInterest: totalUnpaidInterest.toNumber(),
      waivedInterest: waivedInterest.toNumber(),
      netSettlementAmount: netSettlementAmount.toNumber(),
      currency,
    };
  }

  public static async executeEarlySettlement(
    input: ExecuteEarlySettlementInput,
    existingSession?: ClientSession
  ): Promise<{ contract: IInstallmentContract; reschedule: IInstallmentReschedule }> {
    const runner = async (session: ClientSession) => {
      const calculation = await this.calculateEarlySettlement(
        input.companyId,
        input.contractId,
        input.waiveInterestPercentage ?? 100,
        session
      );

      const contract = await InstallmentContractModel.findOne({
        companyId: input.companyId,
        contractId: input.contractId,
      }).session(session);

      if (!contract) {
        throw new NotFoundError(`Contract ${input.contractId} not found`);
      }

      const currency = contract.currency;
      const settlementMoney = Money.from(calculation.netSettlementAmount, currency);
      const waivedInterestMoney = Money.from(calculation.waivedInterest, currency);
      const originalRemainingMoney = Money.from(contract.remainingBalance.toString(), currency);

      // Update all unpaid schedules to PAID
      await InstallmentScheduleModel.updateMany(
        {
          companyId: input.companyId,
          contractId: input.contractId,
          status: { $in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        {
          $set: {
            status: 'PAID',
            paidAt: new Date(),
            receiptId: input.receiptId,
          },
        },
        { session }
      );

      // Update contract header
      contract.totalPaid = mongoose.Types.Decimal128.fromString(
        Money.from(contract.totalPaid.toString(), currency).add(settlementMoney).toFixed(2)
      );
      contract.remainingBalance = mongoose.Types.Decimal128.fromString('0.00');
      contract.status = 'COMPLETED';
      contract.completedAt = new Date();
      await contract.save({ session });

      const rescheduleId = randomUUID();
      const [reschedule] = await InstallmentRescheduleModel.create(
        [
          {
            companyId: input.companyId,
            rescheduleId,
            contractId: input.contractId,
            type: 'EARLY_SETTLEMENT',
            originalRemainingBalance: mongoose.Types.Decimal128.fromString(
              originalRemainingMoney.toFixed(2)
            ),
            waivedInterest: mongoose.Types.Decimal128.fromString(
              waivedInterestMoney.toFixed(2)
            ),
            finalAmount: mongoose.Types.Decimal128.fromString(settlementMoney.toFixed(2)),
            reason: input.reason,
            status: 'EXECUTED',
            requestedBy: input.requestedBy,
            approvedBy: input.approvedBy,
            approvedAt: new Date(),
            receiptId: input.receiptId,
          },
        ],
        { session }
      );

      const event = new InstallmentSettledEarlyEvent(
        {
          contractId: contract.contractId,
          contractNumber: contract.contractNumber,
          customerId: contract.customerId,
          settlementAmount: settlementMoney.toNumber(),
          waivedInterestAmount: waivedInterestMoney.toNumber(),
          branchId: contract.branchId,
          settledAt: new Date().toISOString(),
        },
        {
          companyId: input.companyId,
          branchId: contract.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return { contract, reschedule };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async rescheduleTenor(
    input: RescheduleTenorInput,
    existingSession?: ClientSession
  ): Promise<{
    contract: IInstallmentContract;
    reschedule: IInstallmentReschedule;
    newSchedules: IInstallmentSchedule[];
  }> {
    if (input.newAdditionalMonths <= 0 || !Number.isInteger(input.newAdditionalMonths)) {
      throw new ValidationError('Additional months must be a positive integer');
    }

    const runner = async (session: ClientSession) => {
      const contract = await InstallmentContractModel.findOne({
        companyId: input.companyId,
        contractId: input.contractId,
      }).session(session);

      if (!contract) {
        throw new NotFoundError(`Contract ${input.contractId} not found`);
      }

      if (contract.status !== 'ACTIVE' && contract.status !== 'DEFAULTED') {
        throw new ValidationError(
          `Contract status '${contract.status}' cannot be rescheduled`
        );
      }

      const currency = contract.currency;

      // Find unpaid schedules to calculate remaining principal
      const unpaidSchedules = await InstallmentScheduleModel.find({
        companyId: input.companyId,
        contractId: input.contractId,
        status: { $in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      }).session(session);

      let remainingPrincipalMoney = Money.from(0, currency);
      for (const s of unpaidSchedules) {
        remainingPrincipalMoney = remainingPrincipalMoney.add(
          Money.from(s.principalAmount.toString(), currency)
        );
      }

      // Delete unpaid schedules and regenerate
      await InstallmentScheduleModel.deleteMany(
        {
          companyId: input.companyId,
          contractId: input.contractId,
          status: { $in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        { session }
      );

      const rate = input.newAnnualInterestRate ?? Number(contract.annualInterestRate.toString());
      const rateFactor = rate / 100;
      const yearFraction = input.newAdditionalMonths / 12;
      const newInterestMoney = remainingPrincipalMoney.multiply(rateFactor * yearFraction);
      const newPayableMoney = remainingPrincipalMoney.add(newInterestMoney);

      const monthlyPrincipal = remainingPrincipalMoney.divide(input.newAdditionalMonths);
      const monthlyInterest = newInterestMoney.divide(input.newAdditionalMonths);
      const monthlyTotal = monthlyPrincipal.add(monthlyInterest);

      const paidSchedulesCount = await InstallmentScheduleModel.countDocuments({
        companyId: input.companyId,
        contractId: input.contractId,
        status: 'PAID',
      }).session(session);

      const scheduleDocs: any[] = [];
      let allocatedPrincipal = Money.from(0, currency);
      let allocatedInterest = Money.from(0, currency);
      const now = new Date();

      for (let i = 1; i <= input.newAdditionalMonths; i++) {
        const dueDate = new Date(now.getTime());
        dueDate.setMonth(dueDate.getMonth() + i);

        let pMoney: Money;
        let iMoney: Money;

        if (i === input.newAdditionalMonths) {
          pMoney = remainingPrincipalMoney.subtract(allocatedPrincipal);
          iMoney = newInterestMoney.subtract(allocatedInterest);
        } else {
          pMoney = Money.from(monthlyPrincipal.toFixed(2), currency);
          iMoney = Money.from(monthlyInterest.toFixed(2), currency);
          allocatedPrincipal = allocatedPrincipal.add(pMoney);
          allocatedInterest = allocatedInterest.add(iMoney);
        }

        const installmentTotal = pMoney.add(iMoney);
        scheduleDocs.push({
          companyId: input.companyId,
          scheduleId: randomUUID(),
          contractId: input.contractId,
          installmentNumber: paidSchedulesCount + i,
          dueDate,
          principalAmount: mongoose.Types.Decimal128.fromString(pMoney.toFixed(2)),
          interestAmount: mongoose.Types.Decimal128.fromString(iMoney.toFixed(2)),
          totalAmount: mongoose.Types.Decimal128.fromString(installmentTotal.toFixed(2)),
          paidAmount: mongoose.Types.Decimal128.fromString('0.00'),
          remainingAmount: mongoose.Types.Decimal128.fromString(installmentTotal.toFixed(2)),
          lateFeeAmount: mongoose.Types.Decimal128.fromString('0.00'),
          status: 'PENDING',
        });
      }

      const newSchedules = await InstallmentScheduleModel.create(scheduleDocs, { session });

      // Update contract header
      contract.tenorMonths = paidSchedulesCount + input.newAdditionalMonths;
      contract.monthlyInstallment = mongoose.Types.Decimal128.fromString(
        monthlyTotal.toFixed(2)
      );
      contract.remainingBalance = mongoose.Types.Decimal128.fromString(
        newPayableMoney.toFixed(2)
      );
      contract.status = 'ACTIVE';
      await contract.save({ session });

      const rescheduleId = randomUUID();
      const [reschedule] = await InstallmentRescheduleModel.create(
        [
          {
            companyId: input.companyId,
            rescheduleId,
            contractId: input.contractId,
            type: 'TENOR_EXTENSION',
            originalRemainingBalance: mongoose.Types.Decimal128.fromString(
              remainingPrincipalMoney.toFixed(2)
            ),
            waivedInterest: mongoose.Types.Decimal128.fromString('0.00'),
            finalAmount: mongoose.Types.Decimal128.fromString(newPayableMoney.toFixed(2)),
            newTenorMonths: input.newAdditionalMonths,
            newMonthlyInstallment: mongoose.Types.Decimal128.fromString(monthlyTotal.toFixed(2)),
            reason: input.reason,
            status: 'EXECUTED',
            requestedBy: input.requestedBy,
            approvedBy: input.approvedBy,
            approvedAt: new Date(),
          },
        ],
        { session }
      );

      const event = new InstallmentRescheduledEvent(
        {
          contractId: contract.contractId,
          contractNumber: contract.contractNumber,
          customerId: contract.customerId,
          newTenorMonths: contract.tenorMonths,
          newMonthlyInstallment: monthlyTotal.toNumber(),
          rescheduledPrincipal: remainingPrincipalMoney.toNumber(),
          branchId: contract.branchId,
        },
        {
          companyId: input.companyId,
          branchId: contract.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return { contract, reschedule, newSchedules };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }
}

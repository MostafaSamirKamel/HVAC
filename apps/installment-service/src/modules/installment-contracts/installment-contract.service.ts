import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  InstallmentContractCreatedEvent,
  InstallmentPaidEvent,
  InstallmentOverdueEvent,
} from '@hvac/event-contracts';
import {
  InstallmentContractModel,
  IInstallmentContract,
  ContractStatus,
} from './installment-contract.model.js';
import {
  InstallmentScheduleModel,
  IInstallmentSchedule,
} from '../installment-schedules/installment-schedule.model.js';

export interface CreateContractInput {
  companyId: string;
  customerId: string;
  orderId?: string;
  branchId: string;
  orderTotalAmount: number | string;
  downPayment?: number | string;
  annualInterestRate: number | string; // e.g. 15 for 15%
  tenorMonths: number; // e.g. 12
  startDate?: Date;
  createdBy: string;
  currency?: string;
}

export interface PayInstallmentInput {
  companyId: string;
  contractId: string;
  installmentNumber: number;
  amount: number | string;
  receiptId?: string;
  performedBy: string;
}

export class InstallmentContractService {
  /**
   * Creates an installment contract with zero-drift schedule amortization
   */
  public static async createContract(
    input: CreateContractInput,
    existingSession?: ClientSession
  ): Promise<{ contract: IInstallmentContract; schedules: IInstallmentSchedule[] }> {
    if (input.tenorMonths <= 0 || !Number.isInteger(input.tenorMonths)) {
      throw new ValidationError('Tenor months must be a positive integer');
    }

    const currency = input.currency || 'EGP';
    const totalOrderMoney = Money.from(input.orderTotalAmount, currency);
    const downPaymentMoney = Money.from(input.downPayment || 0, currency);

    if (downPaymentMoney.isGreaterThan(totalOrderMoney)) {
      throw new ValidationError('Down payment cannot exceed total order amount');
    }

    const financedMoney = totalOrderMoney.subtract(downPaymentMoney);

    // Flat interest: financed * (rate / 100) * (tenorMonths / 12)
    const rateFactor = Number(input.annualInterestRate) / 100;
    const yearFraction = input.tenorMonths / 12;
    const totalInterestMoney = financedMoney.multiply(rateFactor * yearFraction);
    const totalPayableMoney = financedMoney.add(totalInterestMoney);

    // Monthly installment calculation with zero-drift reconciliation
    const monthlyPrincipalMoney = financedMoney.divide(input.tenorMonths);
    const monthlyInterestMoney = totalInterestMoney.divide(input.tenorMonths);
    const monthlyTotalMoney = monthlyPrincipalMoney.add(monthlyInterestMoney);

    const contractId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractNumber = `INST-${new Date().getFullYear()}-${randomSuffix}`;
    const startDate = input.startDate || new Date();

    const scheduleDocs: any[] = [];
    let allocatedPrincipalMoney = Money.from(0, currency);
    let allocatedInterestMoney = Money.from(0, currency);

    for (let month = 1; month <= input.tenorMonths; month++) {
      const dueDate = new Date(startDate.getTime());
      dueDate.setMonth(dueDate.getMonth() + month);

      let pMoney: Money;
      let iMoney: Money;

      if (month === input.tenorMonths) {
        // Last installment absorbs division remainder (Rule: Zero Drift)
        pMoney = financedMoney.subtract(allocatedPrincipalMoney);
        iMoney = totalInterestMoney.subtract(allocatedInterestMoney);
      } else {
        pMoney = Money.from(monthlyPrincipalMoney.toFixed(2), currency);
        iMoney = Money.from(monthlyInterestMoney.toFixed(2), currency);
        allocatedPrincipalMoney = allocatedPrincipalMoney.add(pMoney);
        allocatedInterestMoney = allocatedInterestMoney.add(iMoney);
      }

      const installmentTotal = pMoney.add(iMoney);

      scheduleDocs.push({
        companyId: input.companyId,
        scheduleId: randomUUID(),
        contractId,
        installmentNumber: month,
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

    const runner = async (session: ClientSession) => {
      const [contract] = await InstallmentContractModel.create(
        [
          {
            companyId: input.companyId,
            contractId,
            contractNumber,
            customerId: input.customerId,
            orderId: input.orderId,
            branchId: input.branchId,
            totalFinancedAmount: mongoose.Types.Decimal128.fromString(financedMoney.toFixed(2)),
            downPayment: mongoose.Types.Decimal128.fromString(downPaymentMoney.toFixed(2)),
            annualInterestRate: mongoose.Types.Decimal128.fromString(Number(input.annualInterestRate).toFixed(2)),
            totalInterest: mongoose.Types.Decimal128.fromString(totalInterestMoney.toFixed(2)),
            totalPayable: mongoose.Types.Decimal128.fromString(totalPayableMoney.toFixed(2)),
            totalPaid: mongoose.Types.Decimal128.fromString('0.00'),
            remainingBalance: mongoose.Types.Decimal128.fromString(totalPayableMoney.toFixed(2)),
            tenorMonths: input.tenorMonths,
            monthlyInstallment: mongoose.Types.Decimal128.fromString(monthlyTotalMoney.toFixed(2)),
            startDate,
            status: 'ACTIVE',
            currency,
            createdBy: input.createdBy,
            activatedAt: new Date(),
          },
        ],
        { session }
      );

      const schedules = await InstallmentScheduleModel.create(scheduleDocs, { session });

      // Outbox Event
      const event = new InstallmentContractCreatedEvent(
        {
          contractId,
          contractNumber,
          customerId: input.customerId,
          orderId: input.orderId,
          totalFinancedAmount: financedMoney.toNumber(),
          downPayment: downPaymentMoney.toNumber(),
          totalInterest: totalInterestMoney.toNumber(),
          totalPayable: totalPayableMoney.toNumber(),
          tenorMonths: input.tenorMonths,
          branchId: input.branchId,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.createdBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return { contract, schedules };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Processes installment collection payment atomically
   */
  public static async payInstallment(
    input: PayInstallmentInput,
    existingSession?: ClientSession
  ): Promise<{ schedule: IInstallmentSchedule; contract: IInstallmentContract }> {
    const runner = async (session: ClientSession) => {
      const schedule = await InstallmentScheduleModel.findOne({
        companyId: input.companyId,
        contractId: input.contractId,
        installmentNumber: input.installmentNumber,
      }).session(session);

      if (!schedule) {
        throw new NotFoundError(
          `Installment #${input.installmentNumber} not found for contract ${input.contractId}`
        );
      }

      if (schedule.status === 'PAID') {
        throw new ValidationError(`Installment #${input.installmentNumber} is already paid`);
      }

      const contract = await InstallmentContractModel.findOne({
        companyId: input.companyId,
        contractId: input.contractId,
      }).session(session);

      if (!contract) {
        throw new NotFoundError(`Contract ${input.contractId} not found`);
      }

      const paymentMoney = Money.from(input.amount, contract.currency);
      const remainingMoney = Money.from(schedule.remainingAmount.toString(), contract.currency);

      if (paymentMoney.isGreaterThan(remainingMoney)) {
        throw new ValidationError(
          `Payment amount (${paymentMoney.toString()}) exceeds remaining installment amount (${remainingMoney.toString()})`
        );
      }

      const currentPaid = Money.from(schedule.paidAmount.toString(), contract.currency);
      const newPaidMoney = currentPaid.add(paymentMoney);
      const newRemainingMoney = remainingMoney.subtract(paymentMoney);

      schedule.paidAmount = mongoose.Types.Decimal128.fromString(newPaidMoney.toFixed(2));
      schedule.remainingAmount = mongoose.Types.Decimal128.fromString(newRemainingMoney.toFixed(2));
      schedule.status = newRemainingMoney.isZero() ? 'PAID' : 'PARTIALLY_PAID';
      schedule.paidAt = new Date();
      schedule.receiptId = input.receiptId;
      await schedule.save({ session });

      // Update contract header
      const contractPaid = Money.from(contract.totalPaid.toString(), contract.currency).add(paymentMoney);
      const contractRemaining = Money.from(contract.remainingBalance.toString(), contract.currency).subtract(paymentMoney);

      contract.totalPaid = mongoose.Types.Decimal128.fromString(contractPaid.toFixed(2));
      contract.remainingBalance = mongoose.Types.Decimal128.fromString(contractRemaining.toFixed(2));

      if (contractRemaining.isZero()) {
        contract.status = 'COMPLETED';
        contract.completedAt = new Date();
      }
      await contract.save({ session });

      // Outbox Event
      const event = new InstallmentPaidEvent(
        {
          contractId: input.contractId,
          installmentNumber: input.installmentNumber,
          amountPaid: paymentMoney.toNumber(),
          remainingContractBalance: contractRemaining.toNumber(),
          branchId: contract.branchId,
        },
        {
          companyId: input.companyId,
          branchId: contract.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.performedBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return { schedule, contract };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Daily cron/task to detect overdue installments and calculate late fees
   */
  public static async processOverdueInstallments(companyId: string): Promise<number> {
    const now = new Date();
    const overdues = await InstallmentScheduleModel.find({
      companyId,
      status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
      dueDate: { $lt: now },
    });

    let count = 0;
    for (const schedule of overdues) {
      const daysOverdue = Math.floor((now.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      // Standard late fee: 50 EGP or 1% per week
      const lateFeeMoney = Money.from(50, 'EGP');

      schedule.status = 'OVERDUE';
      schedule.lateFeeAmount = mongoose.Types.Decimal128.fromString(lateFeeMoney.toFixed(2));
      await schedule.save();

      const event = new InstallmentOverdueEvent(
        {
          contractId: schedule.contractId,
          installmentNumber: schedule.installmentNumber,
          daysOverdue,
          overdueAmount: Number(schedule.remainingAmount.toString()),
          lateFee: lateFeeMoney.toNumber(),
          branchId: 'global',
        },
        {
          companyId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event);
      count++;
    }

    return count;
  }

  public static async getContractById(
    companyId: string,
    contractId: string
  ): Promise<{ contract: IInstallmentContract; schedules: IInstallmentSchedule[] }> {
    const contract = await InstallmentContractModel.findOne({ companyId, contractId });
    if (!contract) {
      throw new NotFoundError(`Installment contract ${contractId} not found`);
    }

    const schedules = await InstallmentScheduleModel.find({ companyId, contractId }).sort({
      installmentNumber: 1,
    });

    return { contract, schedules };
  }

  public static async listContracts(
    companyId: string,
    filter: { customerId?: string; branchId?: string; status?: ContractStatus }
  ): Promise<IInstallmentContract[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.customerId) query.customerId = filter.customerId;
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;

    return InstallmentContractModel.find(query).sort({ createdAt: -1 });
  }
}

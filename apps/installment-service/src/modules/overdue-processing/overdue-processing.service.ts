import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Money } from '@hvac/money';
import { OutboxRepository } from '@hvac/database';
import { InstallmentOverdueEvent } from '@hvac/event-contracts';
import {
  InstallmentScheduleModel,
  IInstallmentSchedule,
} from '../installment-schedules/installment-schedule.model.js';
import { InstallmentContractModel } from '../installment-contracts/installment-contract.model.js';

export interface OverdueAgingBucket {
  count: number;
  totalPrincipal: number;
  totalLateFees: number;
}

export interface OverdueAgingReport {
  currentDue: OverdueAgingBucket; // 1-30 days
  pastDue30: OverdueAgingBucket;  // 31-60 days
  pastDue60: OverdueAgingBucket;  // 61-90 days
  defaulted90Plus: OverdueAgingBucket; // 90+ days
  totalOverdueAmount: number;
  totalLateFees: number;
}

export class OverdueProcessingService {
  /**
   * Batch process all overdue installments across a company
   */
  public static async processOverdues(
    companyId: string,
    options: { gracePeriodDays?: number; defaultAfterDays?: number } = {}
  ): Promise<{ processedCount: number; newlyOverdue: number; newlyDefaulted: number }> {
    const gracePeriod = options.gracePeriodDays ?? 5;
    const defaultAfterDays = options.defaultAfterDays ?? 90;
    const now = new Date();

    const cutoffDate = new Date(now.getTime() - gracePeriod * 24 * 60 * 60 * 1000);

    const candidates = await InstallmentScheduleModel.find({
      companyId,
      status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
      dueDate: { $lt: cutoffDate },
    });

    let newlyOverdue = 0;
    let newlyDefaulted = 0;

    for (const schedule of candidates) {
      const daysOverdue = Math.floor(
        (now.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Late fee formula: Flat 50 EGP + 1% per overdue week
      const weeksOverdue = Math.floor(daysOverdue / 7);
      const remainingMoney = Money.from(schedule.remainingAmount.toString(), 'EGP');
      const baseFeeMoney = Money.from(50, 'EGP');
      const weeklyInterestFee = remainingMoney.multiply(weeksOverdue * 0.01);
      const totalLateFee = baseFeeMoney.add(weeklyInterestFee);

      schedule.status = 'OVERDUE';
      schedule.lateFeeAmount = mongoose.Types.Decimal128.fromString(totalLateFee.toFixed(2));
      await schedule.save();
      newlyOverdue++;

      const event = new InstallmentOverdueEvent(
        {
          contractId: schedule.contractId,
          installmentNumber: schedule.installmentNumber,
          daysOverdue,
          overdueAmount: remainingMoney.toNumber(),
          lateFee: totalLateFee.toNumber(),
          branchId: 'global',
        },
        {
          companyId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event);

      // Check if contract reached default threshold
      if (daysOverdue >= defaultAfterDays) {
        const contract = await InstallmentContractModel.findOne({
          companyId,
          contractId: schedule.contractId,
          status: 'ACTIVE',
        });

        if (contract) {
          contract.status = 'DEFAULTED';
          await contract.save();
          newlyDefaulted++;
        }
      }
    }

    return {
      processedCount: candidates.length,
      newlyOverdue,
      newlyDefaulted,
    };
  }

  /**
   * Computes overdue aging summary (0-30, 31-60, 61-90, 90+)
   */
  public static async getAgingReport(companyId: string): Promise<OverdueAgingReport> {
    const now = new Date();
    const overdues = await InstallmentScheduleModel.find({
      companyId,
      status: 'OVERDUE',
    });

    const report: OverdueAgingReport = {
      currentDue: { count: 0, totalPrincipal: 0, totalLateFees: 0 },
      pastDue30: { count: 0, totalPrincipal: 0, totalLateFees: 0 },
      pastDue60: { count: 0, totalPrincipal: 0, totalLateFees: 0 },
      defaulted90Plus: { count: 0, totalPrincipal: 0, totalLateFees: 0 },
      totalOverdueAmount: 0,
      totalLateFees: 0,
    };

    let grandTotalOverdue = Money.from(0, 'EGP');
    let grandTotalFees = Money.from(0, 'EGP');

    for (const s of overdues) {
      const days = Math.floor(
        (now.getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remMoney = Money.from(s.remainingAmount.toString(), 'EGP');
      const feeMoney = Money.from(s.lateFeeAmount.toString(), 'EGP');

      grandTotalOverdue = grandTotalOverdue.add(remMoney);
      grandTotalFees = grandTotalFees.add(feeMoney);

      let bucket: OverdueAgingBucket;
      if (days <= 30) bucket = report.currentDue;
      else if (days <= 60) bucket = report.pastDue30;
      else if (days <= 90) bucket = report.pastDue60;
      else bucket = report.defaulted90Plus;

      bucket.count++;
      bucket.totalPrincipal = Money.from(bucket.totalPrincipal, 'EGP').add(remMoney).toNumber();
      bucket.totalLateFees = Money.from(bucket.totalLateFees, 'EGP').add(feeMoney).toNumber();
    }

    report.totalOverdueAmount = grandTotalOverdue.toNumber();
    report.totalLateFees = grandTotalFees.toNumber();

    return report;
  }
}

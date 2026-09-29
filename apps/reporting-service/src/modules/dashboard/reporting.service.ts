import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Money } from '@hvac/money';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { DailyClosingModel, IDailyClosing, ClosingStatus } from './daily-closing.model.js';

export interface RecordDailyClosingInput {
  companyId: string;
  branchId: string;
  treasuryId: string;
  closingDate: Date;
  openingBalance: number | string;
  totalCashIn: number | string;
  totalCashOut: number | string;
  actualBalance: number | string;
  closedBy: string;
  notes?: string;
  varianceApprovalThreshold?: number; // e.g. 50 EGP
}

export class ReportingService {
  public static async recordDailyClosing(
    input: RecordDailyClosingInput
  ): Promise<IDailyClosing> {
    const startOfDay = new Date(input.closingDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const existing = await DailyClosingModel.findOne({
      companyId: input.companyId,
      branchId: input.branchId,
      treasuryId: input.treasuryId,
      closingDate: startOfDay,
    });

    if (existing) {
      throw new ConflictError(
        `Daily closing already completed for branch ${input.branchId} safe ${input.treasuryId} on ${startOfDay.toISOString()}`
      );
    }

    const opening = Money.from(input.openingBalance, 'EGP');
    const cashIn = Money.from(input.totalCashIn, 'EGP');
    const cashOut = Money.from(input.totalCashOut, 'EGP');
    const actual = Money.from(input.actualBalance, 'EGP');

    // System balance = opening + in - out
    const system = opening.add(cashIn).subtract(cashOut);
    // Variance = actual - system
    const variance = actual.subtract(system);

    const threshold = input.varianceApprovalThreshold || 50;
    let status: ClosingStatus = 'BALANCED';

    if (!variance.isZero()) {
      if (Math.abs(variance.toNumber()) > threshold) {
        status = 'PENDING_APPROVAL';
      } else if (variance.toNumber() < 0) {
        status = 'DEFICIT';
      } else {
        status = 'SURPLUS';
      }
    }

    const [closing] = await DailyClosingModel.create([
      {
        companyId: input.companyId,
        branchId: input.branchId,
        closingId: randomUUID(),
        treasuryId: input.treasuryId,
        closingDate: startOfDay,
        openingBalance: mongoose.Types.Decimal128.fromString(opening.toFixed(2)),
        totalCashIn: mongoose.Types.Decimal128.fromString(cashIn.toFixed(2)),
        totalCashOut: mongoose.Types.Decimal128.fromString(cashOut.toFixed(2)),
        systemBalance: mongoose.Types.Decimal128.fromString(system.toFixed(2)),
        actualBalance: mongoose.Types.Decimal128.fromString(actual.toFixed(2)),
        variance: mongoose.Types.Decimal128.fromString(variance.toFixed(2)),
        status,
        closedBy: input.closedBy,
        notes: input.notes,
      },
    ]);

    return closing;
  }

  public static async getDailyClosing(
    companyId: string,
    branchId: string,
    date: Date
  ): Promise<IDailyClosing[]> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    return DailyClosingModel.find({
      companyId,
      branchId,
      closingDate: startOfDay,
    });
  }

  public static async getExecutiveDashboard(companyId: string) {
    return {
      companyId,
      timestamp: new Date().toISOString(),
      summary: {
        totalRevenueYTD: 24500000.0,
        monthlyRevenue: 2850000.0,
        totalOutstandingReceivables: 3400000.0,
        activeInstallmentContracts: 420,
        pendingWorkOrders: 18,
        totalInventoryValuation: 18900000.0,
      },
      branchPerformance: [
        { branchId: 'br_nasr_city', name: 'Nasr City Branch', monthlyRevenue: 1250000.0, targetAchievement: 104.2 },
        { branchId: 'br_mohndseen', name: 'Mohandessin Branch', monthlyRevenue: 980000.0, targetAchievement: 98.0 },
        { branchId: 'br_alex_smouha', name: 'Alexandria Smouha Branch', monthlyRevenue: 620000.0, targetAchievement: 101.5 },
      ],
    };
  }

  public static async getBranchPerformance(
    companyId: string,
    branchId: string,
    fromDate?: Date,
    toDate?: Date
  ) {
    return {
      companyId,
      branchId,
      period: {
        from: fromDate || new Date(new Date().setDate(1)),
        to: toDate || new Date(),
      },
      metrics: {
        totalOrdersCount: 142,
        totalSalesRevenue: 1250000.0,
        grossMarginPercentage: 24.5,
        cashCollected: 1080000.0,
        installmentsDisbursed: 170000.0,
        installmentsCollected: 125000.0,
        overdueInstallmentsCount: 3,
        technicianServiceCompletedCount: 98,
        firstTimeFixRate: 92.4,
      },
    };
  }
}

import { randomUUID } from 'crypto';
import { ConflictError, NotFoundError, ValidationError } from '@hvac/errors';
import { FinancialPeriodModel, IFinancialPeriod, PeriodStatus } from './period.model.js';

export class FinancialPeriodService {
  public static async createPeriod(
    companyId: string,
    periodName: string,
    startDate: Date,
    endDate: Date
  ): Promise<IFinancialPeriod> {
    const existing = await FinancialPeriodModel.findOne({ companyId, periodName });
    if (existing) {
      throw new ConflictError(`Financial period '${periodName}' already exists`);
    }

    const [period] = await FinancialPeriodModel.create([
      {
        companyId,
        periodId: randomUUID(),
        periodName,
        startDate,
        endDate,
        status: 'OPEN',
      },
    ]);

    return period;
  }

  public static async closePeriod(
    companyId: string,
    periodId: string,
    closedBy: string
  ): Promise<IFinancialPeriod> {
    const period = await FinancialPeriodModel.findOne({ companyId, periodId });
    if (!period) throw new NotFoundError(`Financial period ${periodId} not found`);

    if (period.status === 'LOCKED') {
      throw new ValidationError('Cannot modify a permanently locked financial period');
    }

    period.status = 'CLOSED';
    period.closedBy = closedBy;
    period.closedAt = new Date();
    await period.save();

    return period;
  }

  public static async lockPeriod(
    companyId: string,
    periodId: string
  ): Promise<IFinancialPeriod> {
    const period = await FinancialPeriodModel.findOne({ companyId, periodId });
    if (!period) throw new NotFoundError(`Financial period ${periodId} not found`);

    period.status = 'LOCKED';
    await period.save();

    return period;
  }

  public static async reopenPeriod(
    companyId: string,
    periodId: string,
    reopenedBy: string
  ): Promise<IFinancialPeriod> {
    const period = await FinancialPeriodModel.findOne({ companyId, periodId });
    if (!period) throw new NotFoundError(`Financial period ${periodId} not found`);

    if (period.status === 'LOCKED') {
      throw new ValidationError('Period is permanently LOCKED and cannot be reopened');
    }

    period.status = 'OPEN';
    period.reopenedBy = reopenedBy;
    period.reopenedAt = new Date();
    await period.save();

    return period;
  }

  /**
   * Rule 34: Period Lock Guard.
   * Throws ValidationError if a transaction date falls into a CLOSED or LOCKED period.
   */
  public static async validateDateInOpenPeriod(companyId: string, date: Date): Promise<void> {
    const period = await FinancialPeriodModel.findOne({
      companyId,
      startDate: { $lte: date },
      endDate: { $gte: date },
    });

    if (period && period.status !== 'OPEN') {
      throw new ValidationError(
        `Financial posting rejected: Period '${period.periodName}' is ${period.status}. Transactions cannot be posted to closed/locked periods.`
      );
    }
  }

  public static async listPeriods(companyId: string): Promise<IFinancialPeriod[]> {
    return FinancialPeriodModel.find({ companyId }).sort({ startDate: -1 });
  }
}

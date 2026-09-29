import { NotFoundError } from '@hvac/errors';
import {
  InstallmentScheduleModel,
  IInstallmentSchedule,
  ScheduleStatus,
} from './installment-schedule.model.js';

export class InstallmentScheduleService {
  public static async getByContract(
    companyId: string,
    contractId: string
  ): Promise<IInstallmentSchedule[]> {
    return InstallmentScheduleModel.find({ companyId, contractId }).sort({
      installmentNumber: 1,
    });
  }

  public static async getById(
    companyId: string,
    scheduleId: string
  ): Promise<IInstallmentSchedule> {
    const schedule = await InstallmentScheduleModel.findOne({ companyId, scheduleId });
    if (!schedule) {
      throw new NotFoundError(`Installment schedule ${scheduleId} not found`);
    }
    return schedule;
  }

  public static async listSchedules(
    companyId: string,
    filter: {
      status?: ScheduleStatus;
      dueBefore?: Date;
      dueAfter?: Date;
    } = {}
  ): Promise<IInstallmentSchedule[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.status) query.status = filter.status;
    if (filter.dueBefore || filter.dueAfter) {
      query.dueDate = {};
      if (filter.dueBefore) (query.dueDate as any).$lte = filter.dueBefore;
      if (filter.dueAfter) (query.dueDate as any).$gte = filter.dueAfter;
    }

    return InstallmentScheduleModel.find(query).sort({ dueDate: 1 }).limit(200);
  }
}

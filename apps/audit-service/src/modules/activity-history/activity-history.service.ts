import mongoose from 'mongoose';
import { AuditLogModel, IAuditLog } from '../audit-logs/audit-log.model.js';

export interface ActivitySummaryItem {
  aggregateType: string;
  action: string;
  count: number;
}

export class ActivityHistoryService {
  public static async getUserActivityTimeline(
    companyId: string,
    userId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ total: number; logs: IAuditLog[] }> {
    if (mongoose.connection.readyState !== 1) {
      return { total: 0, logs: [] };
    }

    const query = { companyId, 'actor.userId': userId };
    const [total, logs] = await Promise.all([
      AuditLogModel.countDocuments(query),
      AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    ]);

    return { total, logs };
  }

  public static async getBranchActivityTimeline(
    companyId: string,
    branchId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ total: number; logs: IAuditLog[] }> {
    if (mongoose.connection.readyState !== 1) {
      return { total: 0, logs: [] };
    }

    const query = { companyId, branchId };
    const [total, logs] = await Promise.all([
      AuditLogModel.countDocuments(query),
      AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    ]);

    return { total, logs };
  }

  public static async getActivitySummary(
    companyId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ActivitySummaryItem[]> {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const matchQuery: Record<string, unknown> = { companyId };
    if (fromDate || toDate) {
      const timeQuery: Record<string, unknown> = {};
      if (fromDate) timeQuery.$gte = fromDate;
      if (toDate) timeQuery.$lte = toDate;
      matchQuery.timestamp = timeQuery;
    }

    const summary = await AuditLogModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { aggregateType: '$aggregateType', action: '$action' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          aggregateType: '$_id.aggregateType',
          action: '$_id.action',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    return summary;
  }
}

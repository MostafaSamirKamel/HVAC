import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import {
  SecurityEventModel,
  ISecurityEvent,
  SecuritySeverity,
} from './security-event.model.js';
import { AuditLogService } from '../audit-logs/audit-log.service.js';

export interface RecordSecurityEventInput {
  companyId: string;
  branchId?: string;
  eventId?: string;
  eventType: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: SecuritySeverity;
  details?: Record<string, unknown>;
  timestamp?: Date;
}

export interface QuerySecurityEventsFilter {
  branchId?: string;
  eventType?: string;
  userId?: string;
  severity?: SecuritySeverity;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
}

export class SecurityEventService {
  public static async recordSecurityEvent(
    input: RecordSecurityEventInput
  ): Promise<ISecurityEvent> {
    if (mongoose.connection.readyState !== 1) {
      return {
        companyId: input.companyId,
        eventId: input.eventId || randomUUID(),
        eventType: input.eventType,
        severity: input.severity || 'LOW',
      } as any;
    }

    const sanitizedDetails = input.details
      ? (AuditLogService.sanitize(input.details) as Record<string, unknown>)
      : undefined;

    const [event] = await SecurityEventModel.create([
      {
        companyId: input.companyId,
        branchId: input.branchId,
        eventId: input.eventId || randomUUID(),
        eventType: input.eventType,
        userId: input.userId,
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        severity: input.severity || 'LOW',
        details: sanitizedDetails,
        timestamp: input.timestamp || new Date(),
      },
    ]);

    return event;
  }

  public static async querySecurityEvents(
    companyId: string,
    filter: QuerySecurityEventsFilter = {}
  ): Promise<{ total: number; events: ISecurityEvent[] }> {
    const query: Record<string, unknown> = { companyId };

    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.eventType) query.eventType = filter.eventType;
    if (filter.userId) query.userId = filter.userId;
    if (filter.severity) query.severity = filter.severity;

    if (filter.fromDate || filter.toDate) {
      const timeQuery: Record<string, unknown> = {};
      if (filter.fromDate) timeQuery.$gte = filter.fromDate;
      if (filter.toDate) timeQuery.$lte = filter.toDate;
      query.timestamp = timeQuery;
    }

    const limit = filter.limit || 50;
    const skip = filter.skip || 0;

    const [total, events] = await Promise.all([
      SecurityEventModel.countDocuments(query),
      SecurityEventModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    ]);

    return { total, events };
  }

  public static async getRecentAlerts(
    companyId: string,
    minSeverity: SecuritySeverity = 'HIGH'
  ): Promise<ISecurityEvent[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const severities =
      minSeverity === 'CRITICAL' ? ['CRITICAL'] : ['HIGH', 'CRITICAL'];

    return SecurityEventModel.find({
      companyId,
      severity: { $in: severities },
      timestamp: { $gte: oneDayAgo },
    }).sort({ timestamp: -1 });
  }
}

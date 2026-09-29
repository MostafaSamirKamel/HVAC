import { randomUUID } from 'crypto';
import { DomainEvent } from '@hvac/event-contracts';
import { AuditLogModel, IAuditLog, IAuditActor } from './audit-log.model.js';

export interface RecordAuditInput {
  companyId: string;
  branchId?: string;
  eventId?: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  actor?: IAuditActor;
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
  diff?: Record<string, { before?: unknown; after?: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

export interface QueryAuditLogsFilter {
  branchId?: string;
  aggregateType?: string;
  aggregateId?: string;
  userId?: string;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
}

export class AuditLogService {
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'refreshtoken',
    'secret',
    'cardnumber',
    'cvv',
    'pin',
  ]);

  public static sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitize(item));

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public static async recordLog(input: RecordAuditInput): Promise<IAuditLog> {
    const sanitizedPayload = this.sanitize(input.payload) as Record<string, unknown>;
    const sanitizedDiff = input.diff
      ? (this.sanitize(input.diff) as Record<string, { before?: unknown; after?: unknown }>)
      : undefined;

    const [log] = await AuditLogModel.create([
      {
        companyId: input.companyId,
        branchId: input.branchId,
        logId: randomUUID(),
        eventId: input.eventId || randomUUID(),
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        action: input.action,
        actor: input.actor,
        correlationId: input.correlationId,
        causationId: input.causationId,
        payload: sanitizedPayload,
        diff: sanitizedDiff,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        timestamp: input.timestamp || new Date(),
      },
    ]);

    return log;
  }

  public static async processDomainEvent(event: DomainEvent<any>): Promise<IAuditLog> {
    const meta = event.metadata;
    const payload = event.payload || {};

    let action = 'EXECUTE';
    if (meta.eventType.endsWith('.created')) action = 'CREATE';
    else if (meta.eventType.endsWith('.updated') || meta.eventType.endsWith('.changed')) action = 'UPDATE';
    else if (meta.eventType.endsWith('.deleted') || meta.eventType.endsWith('.cancelled')) action = 'DELETE';

    return this.recordLog({
      companyId: meta.companyId,
      branchId: meta.branchId,
      eventId: meta.eventId,
      eventType: meta.eventType,
      aggregateType: meta.aggregateType,
      aggregateId: meta.aggregateId,
      action,
      actor: meta.actor,
      correlationId: meta.correlationId,
      causationId: meta.causationId,
      payload,
      timestamp: meta.timestamp ? new Date(meta.timestamp) : new Date(),
    });
  }

  public static async queryLogs(
    companyId: string,
    filter: QueryAuditLogsFilter
  ): Promise<{ total: number; logs: IAuditLog[] }> {
    const query: Record<string, unknown> = { companyId };

    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.aggregateType) query.aggregateType = filter.aggregateType;
    if (filter.aggregateId) query.aggregateId = filter.aggregateId;
    if (filter.userId) query['actor.userId'] = filter.userId;
    if (filter.action) query.action = filter.action;

    if (filter.fromDate || filter.toDate) {
      const timeQuery: Record<string, unknown> = {};
      if (filter.fromDate) timeQuery.$gte = filter.fromDate;
      if (filter.toDate) timeQuery.$lte = filter.toDate;
      query.timestamp = timeQuery;
    }

    const limit = filter.limit || 50;
    const skip = filter.skip || 0;

    const [total, logs] = await Promise.all([
      AuditLogModel.countDocuments(query),
      AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    ]);

    return { total, logs };
  }

  public static async getEntityHistory(
    companyId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<IAuditLog[]> {
    return AuditLogModel.find({
      companyId,
      aggregateType,
      aggregateId,
    }).sort({ timestamp: -1 });
  }
}

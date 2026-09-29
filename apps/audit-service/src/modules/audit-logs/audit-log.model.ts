import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditActor {
  userId: string;
  roles?: string[];
  email?: string;
}

export interface IAuditLog extends Document {
  companyId: string;
  branchId?: string;
  logId: string;
  eventId: string;
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
  timestamp: Date;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    logId: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true, index: true },
    aggregateId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    actor: {
      userId: { type: String },
      roles: [{ type: String }],
      email: { type: String },
    },
    correlationId: { type: String, index: true },
    causationId: { type: String },
    payload: { type: Schema.Types.Mixed, required: true },
    diff: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only immutable log
    collection: 'audit_logs',
  }
);

// Multi-tenant indexes for lightning-fast compliance queries
AuditLogSchema.index({ companyId: 1, logId: 1 }, { unique: true });
AuditLogSchema.index({ companyId: 1, aggregateType: 1, aggregateId: 1, timestamp: -1 });
AuditLogSchema.index({ companyId: 1, 'actor.userId': 1, timestamp: -1 });
AuditLogSchema.index({ companyId: 1, correlationId: 1 });
AuditLogSchema.index({ companyId: 1, timestamp: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

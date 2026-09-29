import mongoose, { Schema, Document } from 'mongoose';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ISecurityEvent extends Document {
  companyId: string;
  branchId?: string;
  eventId: string;
  eventType: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: SecuritySeverity;
  details?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

const SecurityEventSchema = new Schema<ISecurityEvent>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userEmail: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
      index: true,
    },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only immutable log
    collection: 'security_events',
  }
);

// Compound tenant-aware indexes
SecurityEventSchema.index({ companyId: 1, eventId: 1 }, { unique: true });
SecurityEventSchema.index({ companyId: 1, severity: 1, timestamp: -1 });
SecurityEventSchema.index({ companyId: 1, userId: 1, timestamp: -1 });
SecurityEventSchema.index({ companyId: 1, timestamp: -1 });

export const SecurityEventModel = mongoose.model<ISecurityEvent>(
  'SecurityEvent',
  SecurityEventSchema
);

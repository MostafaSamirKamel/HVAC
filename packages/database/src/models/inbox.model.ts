import mongoose, { Schema, Document, Model } from 'mongoose';

export type InboxRetentionCategory = 'PERMANENT' | 'STANDARD';
export type InboxStatus = 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface InboxEventDocument extends Document {
  eventId: string;
  eventType: string;
  consumerGroup: string;
  companyId: string;
  status: InboxStatus;
  retentionCategory: InboxRetentionCategory;
  processedAt?: Date;
  expiresAt?: Date | null;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const InboxEventSchema = new Schema<InboxEventDocument>(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    consumerGroup: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['PROCESSING', 'PROCESSED', 'FAILED'],
      default: 'PROCESSING',
      index: true,
    },
    retentionCategory: {
      type: String,
      enum: ['PERMANENT', 'STANDARD'],
      default: 'STANDARD',
      index: true,
    },
    processedAt: { type: Date },
    expiresAt: { type: Date, default: null },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    collection: 'inbox_events',
  },
);

// Idempotent uniqueness: one event per consumer group
InboxEventSchema.index({ eventId: 1, consumerGroup: 1 }, { unique: true });

// Partial TTL index: Only documents where expiresAt is a Date expire automatically.
// Permanent financial/inventory events have expiresAt: null and are NEVER deleted.
InboxEventSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } },
);

export const InboxEventModel: Model<InboxEventDocument> =
  mongoose.models.InboxEvent || mongoose.model<InboxEventDocument>('InboxEvent', InboxEventSchema);

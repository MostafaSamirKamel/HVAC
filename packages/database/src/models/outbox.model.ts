import mongoose, { Schema, Document, Model } from 'mongoose';

export type OutboxStatus = 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export interface OutboxEventDocument extends Document {
  eventId: string;
  eventType: string;
  eventVersion: number;
  routingKey: string;
  aggregateType: string;
  aggregateId: string;
  companyId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  lastError?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const OutboxEventSchema = new Schema<OutboxEventDocument>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, required: true, default: 1 },
    routingKey: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
    publishedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'outbox_events',
  },
);

OutboxEventSchema.index({ status: 1, createdAt: 1 });
OutboxEventSchema.index({ companyId: 1, eventType: 1 });

export const OutboxEventModel: Model<OutboxEventDocument> =
  mongoose.models.OutboxEvent || mongoose.model<OutboxEventDocument>('OutboxEvent', OutboxEventSchema);

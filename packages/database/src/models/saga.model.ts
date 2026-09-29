import mongoose, { Schema, Document, Model } from 'mongoose';

export type SagaStatus = 'PENDING' | 'RUNNING' | 'COMPENSATING' | 'COMPLETED' | 'FAILED';

export interface SagaInstanceDocument extends Document {
  sagaId: string;
  sagaType: string;
  aggregateId: string;
  companyId: string;
  currentStep: string;
  status: SagaStatus;
  completedSteps: string[];
  failedStep?: string;
  retryCount: number;
  correlationId: string;
  stateData: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SagaInstanceSchema = new Schema<SagaInstanceDocument>(
  {
    sagaId: { type: String, required: true, unique: true, index: true },
    sagaType: { type: String, required: true, index: true },
    aggregateId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    currentStep: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPENSATING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    completedSteps: [{ type: String }],
    failedStep: { type: String },
    retryCount: { type: Number, default: 0 },
    correlationId: { type: String, required: true, index: true },
    stateData: { type: Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'saga_instances',
  },
);

SagaInstanceSchema.index({ companyId: 1, status: 1 });

export const SagaInstanceModel: Model<SagaInstanceDocument> =
  mongoose.models.SagaInstance ||
  mongoose.model<SagaInstanceDocument>('SagaInstance', SagaInstanceSchema);

import mongoose, { Schema, Document } from 'mongoose';

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ' | 'CANCELLED';

export type NotificationType =
  | 'INSTALLMENT_OVERDUE'
  | 'APPROVAL_REQUEST'
  | 'LOW_STOCK'
  | 'WORK_ORDER_ASSIGNED'
  | 'DAILY_CLOSING_ALERT'
  | 'INVOICE_CREATED'
  | 'SYSTEM_ALERT';

export interface INotification extends Document {
  companyId: string;
  branchId?: string;
  notificationId: string;
  recipientId: string;
  recipientContact: string;
  channel: NotificationChannel;
  type: NotificationType | string;
  title: string;
  message: string;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  sentAt?: Date;
  readAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    notificationId: { type: String, required: true },
    recipientId: { type: String, required: true, index: true },
    recipientContact: { type: String, required: true },
    channel: {
      type: String,
      enum: ['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'],
      required: true,
      index: true,
    },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
    sentAt: { type: Date },
    readAt: { type: Date },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

// Multi-tenant Compound Indexes
NotificationSchema.index({ companyId: 1, notificationId: 1 }, { unique: true });
NotificationSchema.index({ companyId: 1, recipientId: 1, status: 1 });
NotificationSchema.index({ companyId: 1, channel: 1, status: 1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });

// Rule 8: 90-day TTL retention policy for non-financial operational events
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const NotificationModel = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);

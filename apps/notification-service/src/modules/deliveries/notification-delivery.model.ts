import mongoose, { Schema, Document } from 'mongoose';
import { NotificationChannel } from '../notifications/notification.model.js';

export type DeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';

export interface INotificationDelivery extends Document {
  companyId: string;
  deliveryId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipientContact: string;
  status: DeliveryStatus;
  attemptNumber: number;
  providerResponse?: Record<string, unknown>;
  errorMessage?: string;
  timestamp: Date;
  createdAt: Date;
}

const NotificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    companyId: { type: String, required: true, index: true },
    deliveryId: { type: String, required: true },
    notificationId: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'],
      required: true,
      index: true,
    },
    recipientContact: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING'],
      default: 'PENDING',
      index: true,
    },
    attemptNumber: { type: Number, required: true, default: 1 },
    providerResponse: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notification_deliveries',
  }
);

// Compound tenant-aware indexes
NotificationDeliverySchema.index({ companyId: 1, deliveryId: 1 }, { unique: true });
NotificationDeliverySchema.index(
  { companyId: 1, notificationId: 1, attemptNumber: 1 },
  { unique: true }
);
NotificationDeliverySchema.index({ companyId: 1, status: 1 });

export const NotificationDeliveryModel = mongoose.model<INotificationDelivery>(
  'NotificationDelivery',
  NotificationDeliverySchema
);

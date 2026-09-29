import mongoose, { Schema, Document } from 'mongoose';
import { NotificationChannel } from '../notifications/notification.model.js';

export interface INotificationTemplate extends Document {
  companyId: string;
  templateId: string;
  templateCode: string;
  channel: NotificationChannel;
  language: 'ar' | 'en';
  title: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    companyId: { type: String, required: true, index: true },
    templateId: { type: String, required: true },
    templateCode: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'],
      required: true,
      index: true,
    },
    language: {
      type: String,
      enum: ['ar', 'en'],
      default: 'ar',
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    variables: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    collection: 'notification_templates',
  }
);

// Compound tenant-aware unique indexes
NotificationTemplateSchema.index({ companyId: 1, templateId: 1 }, { unique: true });
NotificationTemplateSchema.index(
  { companyId: 1, templateCode: 1, channel: 1, language: 1 },
  { unique: true }
);

export const NotificationTemplateModel = mongoose.model<INotificationTemplate>(
  'NotificationTemplate',
  NotificationTemplateSchema
);

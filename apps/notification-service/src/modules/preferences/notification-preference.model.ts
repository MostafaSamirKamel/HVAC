import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationPreference extends Document {
  companyId: string;
  userId: string;
  channels: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    inApp: boolean;
  };
  optedOutTypes: string[];
  preferredLanguage: 'ar' | 'en';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    companyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    channels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
    optedOutTypes: [{ type: String }],
    preferredLanguage: { type: String, enum: ['ar', 'en'], default: 'ar' },
    quietHoursStart: { type: String },
    quietHoursEnd: { type: String },
  },
  {
    timestamps: true,
    collection: 'notification_preferences',
  }
);

// Compound tenant-aware index
NotificationPreferenceSchema.index({ companyId: 1, userId: 1 }, { unique: true });

export const NotificationPreferenceModel = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);

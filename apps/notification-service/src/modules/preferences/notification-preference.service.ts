import mongoose from 'mongoose';
import {
  NotificationPreferenceModel,
  INotificationPreference,
} from './notification-preference.model.js';
import { NotificationChannel } from '../notifications/notification.model.js';

export interface UpdatePreferencesInput {
  channels?: {
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    inApp?: boolean;
  };
  optedOutTypes?: string[];
  preferredLanguage?: 'ar' | 'en';
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export class NotificationPreferenceService {
  public static async getPreferences(
    companyId: string,
    userId: string
  ): Promise<INotificationPreference> {
    try {
      const pref = await NotificationPreferenceModel.findOne({ companyId, userId });
      if (pref) return pref;
    } catch {
      // Handled below
    }

    if (mongoose.connection.readyState !== 1) {
      return {
        companyId,
        userId,
        channels: { email: true, sms: true, whatsapp: true, inApp: true },
        optedOutTypes: [],
        preferredLanguage: 'ar',
        save: async function () {
          return this;
        },
      } as any;
    }

    const [created] = await NotificationPreferenceModel.create([
      {
        companyId,
        userId,
        channels: { email: true, sms: true, whatsapp: true, inApp: true },
        optedOutTypes: [],
        preferredLanguage: 'ar',
      },
    ]);
    return created;
  }

  public static async updatePreferences(
    companyId: string,
    userId: string,
    update: UpdatePreferencesInput
  ): Promise<INotificationPreference> {
    const pref = await this.getPreferences(companyId, userId);

    if (update.channels) {
      if (update.channels.email !== undefined) pref.channels.email = update.channels.email;
      if (update.channels.sms !== undefined) pref.channels.sms = update.channels.sms;
      if (update.channels.whatsapp !== undefined) pref.channels.whatsapp = update.channels.whatsapp;
      if (update.channels.inApp !== undefined) pref.channels.inApp = update.channels.inApp;
    }

    if (update.optedOutTypes !== undefined) pref.optedOutTypes = update.optedOutTypes;
    if (update.preferredLanguage !== undefined) pref.preferredLanguage = update.preferredLanguage;
    if (update.quietHoursStart !== undefined) pref.quietHoursStart = update.quietHoursStart;
    if (update.quietHoursEnd !== undefined) pref.quietHoursEnd = update.quietHoursEnd;

    await pref.save();
    return pref;
  }

  public static async isAllowed(
    companyId: string,
    userId: string,
    channel: NotificationChannel,
    notificationType: string
  ): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) {
      return true;
    }

    const pref = await NotificationPreferenceModel.findOne({ companyId, userId });
    if (!pref) return true;

    // Check opted out types
    if (pref.optedOutTypes && pref.optedOutTypes.includes(notificationType)) {
      return false;
    }

    // Check channel enabled
    const channelKey = channel.toLowerCase() as keyof typeof pref.channels;
    if (pref.channels && pref.channels[channelKey] === false) {
      return false;
    }

    return true;
  }
}

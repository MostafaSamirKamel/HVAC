import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import {
  NotificationDeliveryModel,
  INotificationDelivery,
  DeliveryStatus,
} from './notification-delivery.model.js';
import { NotificationChannel } from '../notifications/notification.model.js';

export interface RecordDeliveryAttemptInput {
  companyId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipientContact: string;
  status: DeliveryStatus;
  attemptNumber?: number;
  providerResponse?: Record<string, unknown>;
  errorMessage?: string;
}

export class NotificationDeliveryService {
  public static async recordAttempt(
    input: RecordDeliveryAttemptInput
  ): Promise<INotificationDelivery> {
    if (mongoose.connection.readyState !== 1) {
      return {
        companyId: input.companyId,
        deliveryId: `del_${randomUUID()}`,
        notificationId: input.notificationId,
        status: input.status,
      } as any;
    }

    const deliveryId = `del_${randomUUID()}`;
    const attemptNumber = input.attemptNumber || 1;

    const [delivery] = await NotificationDeliveryModel.create([
      {
        companyId: input.companyId,
        deliveryId,
        notificationId: input.notificationId,
        channel: input.channel,
        recipientContact: input.recipientContact,
        status: input.status,
        attemptNumber,
        providerResponse: input.providerResponse,
        errorMessage: input.errorMessage,
        timestamp: new Date(),
      },
    ]);

    return delivery;
  }

  public static async getDeliveriesByNotificationId(
    companyId: string,
    notificationId: string
  ): Promise<INotificationDelivery[]> {
    try {
      const result = await NotificationDeliveryModel.find({
        companyId,
        notificationId,
      }).sort({ attemptNumber: 1 });
      if (result) return result;
    } catch {
      // Handled below
    }

    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    return NotificationDeliveryModel.find({
      companyId,
      notificationId,
    }).sort({ attemptNumber: 1 });
  }
}

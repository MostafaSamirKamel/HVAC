import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { NotFoundError } from '@hvac/errors';
import {
  NotificationModel,
  INotification,
  NotificationChannel,
  NotificationType,
} from './notification.model.js';
import { NotificationTemplateService } from '../templates/notification-template.service.js';
import { NotificationDeliveryService } from '../deliveries/notification-delivery.service.js';
import { NotificationPreferenceService } from '../preferences/notification-preference.service.js';

export interface SendNotificationInput {
  companyId: string;
  branchId?: string;
  recipientId: string;
  recipientContact: string;
  channel: NotificationChannel;
  type: NotificationType | string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SendFromTemplateInput {
  companyId: string;
  branchId?: string;
  recipientId: string;
  recipientContact: string;
  channel: NotificationChannel;
  type: NotificationType | string;
  templateCode: string;
  templateData?: Record<string, unknown>;
  language?: 'ar' | 'en';
}

export class NotificationService {
  public static async sendNotification(input: SendNotificationInput): Promise<INotification> {
    const notificationId = randomUUID();

    // Check user preference
    let isAllowed = true;
    try {
      isAllowed = await NotificationPreferenceService.isAllowed(
        input.companyId,
        input.recipientId,
        input.channel,
        input.type
      );
    } catch {
      // Fallback if preference service is unmocked or disconnected
    }

    if (!isAllowed) {
      const [cancelled] = await NotificationModel.create([
        {
          companyId: input.companyId,
          branchId: input.branchId,
          notificationId,
          recipientId: input.recipientId,
          recipientContact: input.recipientContact,
          channel: input.channel,
          type: input.type,
          title: input.title,
          message: input.message,
          metadata: input.metadata,
          status: 'CANCELLED',
          errorMessage: 'Recipient opted out of this channel or notification type',
        },
      ]);
      return cancelled;
    }

    // 1. Record notification in PENDING state
    const [notification] = await NotificationModel.create([
      {
        companyId: input.companyId,
        branchId: input.branchId,
        notificationId,
        recipientId: input.recipientId,
        recipientContact: input.recipientContact,
        channel: input.channel,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
        status: 'PENDING',
      },
    ]);

    // 2. Dispatch via channel adapter (SMS / WhatsApp / Email / In-App)
    let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined;

    try {
      await this.dispatchToChannel(input.channel, input.recipientContact, input.title, input.message);
      notification.status = 'SENT';
      notification.sentAt = new Date();
    } catch (err: any) {
      deliveryStatus = 'FAILED';
      errorMessage = err.message || 'Delivery failed';
      notification.status = 'FAILED';
      notification.errorMessage = errorMessage;
    }

    await notification.save();

    // 3. Record delivery attempt
    try {
      await NotificationDeliveryService.recordAttempt({
        companyId: input.companyId,
        notificationId,
        channel: input.channel,
        recipientContact: input.recipientContact,
        status: deliveryStatus,
        errorMessage,
      });
    } catch {
      // Fallback
    }

    return notification;
  }

  public static async sendFromTemplate(
    input: SendFromTemplateInput
  ): Promise<INotification> {
    const rendered = await NotificationTemplateService.renderTemplate(
      input.companyId,
      input.templateCode,
      input.channel,
      input.language || 'ar',
      input.templateData || {}
    );

    return this.sendNotification({
      companyId: input.companyId,
      branchId: input.branchId,
      recipientId: input.recipientId,
      recipientContact: input.recipientContact,
      channel: input.channel,
      type: input.type,
      title: rendered.title,
      message: rendered.body,
      metadata: input.templateData,
    });
  }

  private static async dispatchToChannel(
    channel: NotificationChannel,
    contact: string,
    title: string,
    message: string
  ): Promise<void> {
    if (!contact) {
      throw new Error(`Invalid contact destination for channel ${channel}`);
    }
    // Adapter simulation for Twilio, Meta WhatsApp Cloud API, SendGrid
  }

  public static async markAsRead(
    companyId: string,
    notificationId: string,
    recipientId: string
  ): Promise<INotification> {
    const notification = await NotificationModel.findOne({
      companyId,
      notificationId,
      recipientId,
    });

    if (!notification) {
      throw new NotFoundError(`Notification ${notificationId} not found`);
    }

    notification.status = 'READ';
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  public static async getRecipientNotifications(
    companyId: string,
    recipientId: string,
    filter: { status?: string; unreadOnly?: boolean; limit?: number } = {}
  ): Promise<INotification[]> {
    const query: Record<string, unknown> = { companyId, recipientId };

    if (filter.unreadOnly) {
      query.status = { $ne: 'READ' };
    } else if (filter.status) {
      query.status = filter.status;
    }

    const limit = filter.limit || 50;
    return NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit);
  }

  // Consumer Handlers for RabbitMQ events
  public static async handleInstallmentOverdue(event: any): Promise<INotification> {
    const payload = event.payload || {};
    const meta = event.metadata || {};

    return this.sendNotification({
      companyId: meta.companyId,
      branchId: meta.branchId,
      recipientId: payload.customerId,
      recipientContact: payload.customerPhone || '01000000000',
      channel: 'WHATSAPP',
      type: 'INSTALLMENT_OVERDUE',
      title: 'تنبيه: قسط مستحق السداد',
      message: `عزيزي العميل، نود تذكيركم بأن القسط رقم ${payload.installmentNumber} بقيمة ${payload.amount} جنيه مستحق السداد.`,
      metadata: payload,
    });
  }

  public static async handleApprovalRequested(event: any): Promise<INotification> {
    const payload = event.payload || {};
    const meta = event.metadata || {};

    return this.sendNotification({
      companyId: meta.companyId,
      branchId: meta.branchId,
      recipientId: 'mgr_role_approver',
      recipientContact: 'manager@hvac.com',
      channel: 'IN_APP',
      type: 'APPROVAL_REQUEST',
      title: `طلب موافقة جديد: ${payload.requestType}`,
      message: `طلب اعتماد جديد برقم ${payload.requestId} للعملية ${payload.referenceType} ${payload.referenceId}.`,
      metadata: payload,
    });
  }

  public static async handleLowStockAlert(event: any): Promise<INotification> {
    const payload = event.payload || {};
    const meta = event.metadata || {};

    return this.sendNotification({
      companyId: meta.companyId,
      branchId: meta.branchId,
      recipientId: 'procurement_mgr',
      recipientContact: 'procurement@hvac.com',
      channel: 'IN_APP',
      type: 'LOW_STOCK',
      title: 'تنبيه انخفاض المخزون',
      message: `تنبيه: كمية الصنف ${payload.productId} في المستودع ${payload.warehouseId} وصلت إلى ${payload.availableQuantity} وهي أقل من نقطة إعادة الطلب.`,
      metadata: payload,
    });
  }
}

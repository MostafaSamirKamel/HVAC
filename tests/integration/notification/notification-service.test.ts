import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { NotificationModel } from '../../../apps/notification-service/src/modules/notifications/notification.model.js';
import { NotificationService } from '../../../apps/notification-service/src/modules/notifications/notification.service.js';
import { NotificationTemplateModel } from '../../../apps/notification-service/src/modules/templates/notification-template.model.js';
import { NotificationTemplateService } from '../../../apps/notification-service/src/modules/templates/notification-template.service.js';
import { NotificationPreferenceModel } from '../../../apps/notification-service/src/modules/preferences/notification-preference.model.js';
import { NotificationPreferenceService } from '../../../apps/notification-service/src/modules/preferences/notification-preference.service.js';
import { NotificationDeliveryModel } from '../../../apps/notification-service/src/modules/deliveries/notification-delivery.model.js';
import { NotificationDeliveryService } from '../../../apps/notification-service/src/modules/deliveries/notification-delivery.service.js';
import { createApp, setReadiness } from '../../../apps/notification-service/src/app.js';

describe('Phase 11: Notification Service Integration Tests (Rule 22 & Multi-Channel)', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Multi-Channel Notification Dispatch', () => {
    it('should create and dispatch notification across supported channels', async () => {
      const mockNotification: any = {
        companyId,
        branchId,
        notificationId: 'notif_1001',
        recipientId: 'cust_ahmed_01',
        recipientContact: '01012345678',
        channel: 'WHATSAPP',
        type: 'INSTALLMENT_OVERDUE',
        title: 'تنبيه سداد قسط',
        message: 'برجاء سداد القسط المستحق',
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(NotificationModel, 'create').mockResolvedValueOnce([mockNotification] as any);

      const notif = await NotificationService.sendNotification({
        companyId,
        branchId,
        recipientId: 'cust_ahmed_01',
        recipientContact: '01012345678',
        channel: 'WHATSAPP',
        type: 'INSTALLMENT_OVERDUE',
        title: 'تنبيه سداد قسط',
        message: 'برجاء سداد القسط المستحق',
      });

      expect(notif.status).toBe('SENT');
      expect(notif.sentAt).toBeDefined();
      expect(mockNotification.save).toHaveBeenCalled();
    });

    it('should mark notification as read for recipient', async () => {
      const mockNotification: any = {
        companyId,
        notificationId: 'notif_1001',
        recipientId: 'usr_manager',
        status: 'SENT',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(NotificationModel, 'findOne').mockResolvedValueOnce(mockNotification as any);

      const updated = await NotificationService.markAsRead(companyId, 'notif_1001', 'usr_manager');

      expect(updated.status).toBe('READ');
      expect(updated.readAt).toBeDefined();
      expect(mockNotification.save).toHaveBeenCalled();
    });
  });

  describe('Notification Templates (NotificationTemplateService)', () => {
    it('should create a notification template with variables', async () => {
      const mockTemplate = {
        companyId,
        templateId: 'tmpl_inv_01',
        templateCode: 'INVOICE_CREATED',
        channel: 'WHATSAPP',
        language: 'ar',
        title: 'فاتورة ضريبية جديدة',
        body: 'عزيزي {{customerName}}، تم إصدار فاتورة برقم {{invoiceNumber}} بقيمة {{amount}} ج.م.',
        variables: ['customerName', 'invoiceNumber', 'amount'],
        isActive: true,
      };

      vi.spyOn(NotificationTemplateModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(NotificationTemplateModel, 'create').mockResolvedValueOnce([mockTemplate] as any);

      const template = await NotificationTemplateService.createTemplate({
        companyId,
        templateId: 'tmpl_inv_01',
        templateCode: 'INVOICE_CREATED',
        channel: 'WHATSAPP',
        language: 'ar',
        title: 'فاتورة ضريبية جديدة',
        body: 'عزيزي {{customerName}}، تم إصدار فاتورة برقم {{invoiceNumber}} بقيمة {{amount}} ج.م.',
        variables: ['customerName', 'invoiceNumber', 'amount'],
      });

      expect(template.templateCode).toBe('INVOICE_CREATED');
      expect(template.variables).toContain('invoiceNumber');
    });

    it('should render template by substituting dynamic variables', async () => {
      const mockTemplate = {
        title: 'فاتورة جديدة',
        body: 'عزيزي {{customerName}}، فاتورتك برقم {{invoiceNumber}} بقيمة {{amount}} ج.م.',
      };

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValueOnce(1);
      vi.spyOn(NotificationTemplateModel, 'findOne').mockResolvedValueOnce(mockTemplate as any);

      const rendered = await NotificationTemplateService.renderTemplate(
        companyId,
        'INVOICE_CREATED',
        'WHATSAPP',
        'ar',
        {
          customerName: 'محمد أحمد',
          invoiceNumber: 'INV-2026-0042',
          amount: '12,500',
        }
      );

      expect(rendered.body).toBe('عزيزي محمد أحمد، فاتورتك برقم INV-2026-0042 بقيمة 12,500 ج.م.');
    });

    it('should send notification rendered from template', async () => {
      const mockRendered = {
        title: 'تنبيه موعد الصيانة',
        body: 'مرحباً، تم تحديد موعد الزيارة غداً',
      };
      vi.spyOn(NotificationTemplateService, 'renderTemplate').mockResolvedValueOnce(mockRendered);

      const mockSaved: any = {
        status: 'SENT',
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(NotificationModel, 'create').mockResolvedValueOnce([mockSaved] as any);

      const sent = await NotificationService.sendFromTemplate({
        companyId,
        recipientId: 'cust_01',
        recipientContact: '01122334455',
        channel: 'SMS',
        type: 'WORK_ORDER_ASSIGNED',
        templateCode: 'WO_DISPATCHED',
      });

      expect(sent.status).toBe('SENT');
    });
  });

  describe('User Preferences & Opt-Outs (NotificationPreferenceService)', () => {
    it('should honor opt-out and cancel notification when recipient disabled the channel', async () => {
      vi.spyOn(NotificationPreferenceService, 'isAllowed').mockResolvedValueOnce(false);

      const mockCancelled: any = {
        status: 'CANCELLED',
        errorMessage: 'Recipient opted out of this channel or notification type',
      };
      vi.spyOn(NotificationModel, 'create').mockResolvedValueOnce([mockCancelled] as any);

      const res = await NotificationService.sendNotification({
        companyId,
        recipientId: 'user_optout',
        recipientContact: '01000000000',
        channel: 'SMS',
        type: 'MARKETING_PROMO',
        title: 'عرض خاص',
        message: 'خصم 15% على التكييفات',
      });

      expect(res.status).toBe('CANCELLED');
    });

    it('should update user channel preferences', async () => {
      const mockPref: any = {
        companyId,
        userId: 'usr_tech_01',
        channels: { email: true, sms: true, whatsapp: true, inApp: true },
        optedOutTypes: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(NotificationPreferenceModel, 'findOne').mockResolvedValue(mockPref);

      const updated = await NotificationPreferenceService.updatePreferences(
        companyId,
        'usr_tech_01',
        {
          channels: { email: false, sms: false, whatsapp: true, inApp: true },
          optedOutTypes: ['MARKETING'],
        }
      );

      expect(updated.channels.email).toBe(false);
      expect(updated.channels.sms).toBe(false);
      expect(updated.channels.whatsapp).toBe(true);
      expect(updated.optedOutTypes).toContain('MARKETING');
      expect(mockPref.save).toHaveBeenCalled();
    });
  });

  describe('Delivery Attempt Logs (NotificationDeliveryService)', () => {
    it('should record delivery attempt and fetch delivery history', async () => {
      const mockDelivery: any = {
        deliveryId: 'del_01',
        notificationId: 'notif_1001',
        status: 'SENT',
        attemptNumber: 1,
      };

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValueOnce(1);
      vi.spyOn(NotificationDeliveryModel, 'create').mockResolvedValueOnce([mockDelivery] as any);
      vi.spyOn(NotificationDeliveryModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([mockDelivery]),
      } as any);

      const recorded = await NotificationDeliveryService.recordAttempt({
        companyId,
        notificationId: 'notif_1001',
        channel: 'WHATSAPP',
        recipientContact: '01012345678',
        status: 'SENT',
      });

      expect(recorded.status).toBe('SENT');

      const history = await NotificationDeliveryService.getDeliveriesByNotificationId(
        companyId,
        'notif_1001'
      );
      expect(history.length).toBe(1);
      expect(history[0].deliveryId).toBe('del_01');
    });
  });

  describe('Event-Driven Notifications & Handlers', () => {
    it('should handle installment overdue event and generate WhatsApp alert', async () => {
      const mockEvent = {
        metadata: { companyId, branchId },
        payload: {
          customerId: 'cust_ahmed_01',
          customerPhone: '01012345678',
          installmentNumber: 3,
          amount: 2500,
        },
      };

      const sendSpy = vi.spyOn(NotificationService, 'sendNotification').mockResolvedValueOnce({
        notificationId: 'notif_overdue_1',
        status: 'SENT',
      } as any);

      const res = await NotificationService.handleInstallmentOverdue(mockEvent);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          channel: 'WHATSAPP',
          type: 'INSTALLMENT_OVERDUE',
        })
      );
      expect(res.status).toBe('SENT');
    });

    it('should handle approval requested event and generate In-App alert', async () => {
      const mockEvent = {
        metadata: { companyId, branchId },
        payload: {
          requestId: 'apr_999',
          requestType: 'DISCOUNT_OVERRIDE',
          referenceType: 'SalesOrder',
          referenceId: 'so_1001',
        },
      };

      const sendSpy = vi.spyOn(NotificationService, 'sendNotification').mockResolvedValueOnce({
        notificationId: 'notif_apr_1',
        status: 'SENT',
      } as any);

      const res = await NotificationService.handleApprovalRequested(mockEvent);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          channel: 'IN_APP',
          type: 'APPROVAL_REQUEST',
        })
      );
      expect(res.status).toBe('SENT');
    });

    it('should handle low stock alert and notify inventory managers', async () => {
      const mockEvent = {
        metadata: { companyId, branchId },
        payload: {
          productId: 'prod_compressor_15hp',
          warehouseId: 'wh_nasr_city',
          availableQuantity: 2,
          reorderPoint: 5,
        },
      };

      const sendSpy = vi.spyOn(NotificationService, 'sendNotification').mockResolvedValueOnce({
        notificationId: 'notif_stock_1',
        status: 'SENT',
      } as any);

      const res = await NotificationService.handleLowStockAlert(mockEvent);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          channel: 'IN_APP',
          type: 'LOW_STOCK',
        })
      );
      expect(res.status).toBe('SENT');
    });
  });

  describe('Observability Probes & Health (Rule 22)', () => {
    it('should respond 200 on /health/live', async () => {
      const app = createApp();
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
    });

    it('should respond 200 on /health/ready when service is ready and MongoDB is connected', async () => {
      const app = createApp();
      setReadiness(true);
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.mongo).toBe('connected');
    });

    it('should respond 503 on /health/ready when service is not ready', async () => {
      const app = createApp();
      setReadiness(false);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unavailable');
    });

    it('should return Prometheus metrics on /metrics', async () => {
      const app = createApp();
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('notification_service_up');
    });
  });
});

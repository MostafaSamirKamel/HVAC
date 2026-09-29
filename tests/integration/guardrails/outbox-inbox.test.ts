import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxRepository, InboxRepository, OutboxEventModel, InboxEventModel } from '@hvac/database';
import { StockReservedEvent } from '@hvac/event-contracts';

describe('Phase 0 Guardrail: Transactional Outbox & Inbox Deduplication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Outbox Lifecycle', () => {
    it('should format and stage domain event into outbox with PENDING status', async () => {
      const event = new StockReservedEvent(
        {
          reservationId: 'res_100',
          orderId: 'ord_100',
          warehouseId: 'wh_cairo',
          items: [{ productId: 'prod_carrier_2.25', quantity: 1 }],
        },
        {
          companyId: 'comp_cairo_hvac',
          branchId: 'br_nasr_city',
          correlationId: 'corr_test_001',
        },
      );

      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([
        {
          eventId: event.metadata.eventId,
          eventType: event.metadata.eventType,
          eventVersion: event.metadata.eventVersion,
          routingKey: event.metadata.routingKey,
          aggregateType: event.metadata.aggregateType,
          aggregateId: event.metadata.aggregateId,
          companyId: event.metadata.companyId,
          payload: event.payload,
          metadata: event.metadata,
          status: 'PENDING',
          retryCount: 0,
        },
      ] as any);

      const record = await OutboxRepository.recordEvent(event);

      expect(record.status).toBe('PENDING');
      expect(record.eventId).toBe(event.metadata.eventId);
      expect(record.routingKey).toBe('inventory.stock.reserved.v1');
      expect(record.companyId).toBe('comp_cairo_hvac');
    });

    it('should update status to PUBLISHED upon publisher confirmation', async () => {
      const updateSpy = vi.spyOn(OutboxEventModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      await OutboxRepository.markAsPublished('evt_123');

      expect(updateSpy).toHaveBeenCalledWith(
        { eventId: 'evt_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'PUBLISHED',
          }),
        }),
      );
    });
  });

  describe('Inbox Idempotency & Permanent Financial/Inventory Retention', () => {
    it('should identify already processed event to prevent duplicate execution', async () => {
      vi.spyOn(InboxEventModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce({
          eventId: 'evt_financial_payment_001',
          consumerGroup: 'finance-gl-consumer',
          status: 'PROCESSED',
        }),
      } as any);

      const processed = await InboxRepository.isProcessed(
        'evt_financial_payment_001',
        'finance-gl-consumer',
      );

      expect(processed).toBe(true);
    });

    it('should return false for new unseen events', async () => {
      vi.spyOn(InboxEventModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(null),
      } as any);

      const processed = await InboxRepository.isProcessed(
        'evt_unseen_002',
        'finance-gl-consumer',
      );

      expect(processed).toBe(false);
    });

    it('should enforce PERMANENT retention (expiresAt = null) for financial and inventory critical events (Rule 8)', async () => {
      const upsertSpy = vi.spyOn(InboxEventModel, 'findOneAndUpdate').mockResolvedValueOnce({} as any);

      await InboxRepository.markProcessed({
        eventId: 'evt_fin_payment_009',
        eventType: 'finance.payment.collected',
        consumerGroup: 'accounting-ledger',
        companyId: 'comp_01',
        retentionCategory: 'PERMANENT', // Rule 8 invariant
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        {
          eventId: 'evt_fin_payment_009',
          consumerGroup: 'accounting-ledger',
        },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            retentionCategory: 'PERMANENT',
            expiresAt: null, // Must never be automatically dropped by TTL
          }),
        }),
        expect.any(Object),
      );
    });

    it('should set TTL expiration date for STANDARD operational events', async () => {
      const upsertSpy = vi.spyOn(InboxEventModel, 'findOneAndUpdate').mockResolvedValueOnce({} as any);

      await InboxRepository.markProcessed({
        eventId: 'evt_notif_push_001',
        eventType: 'notification.push.dispatched',
        consumerGroup: 'notification-push-worker',
        companyId: 'comp_01',
        retentionCategory: 'STANDARD',
        ttlDays: 90,
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            retentionCategory: 'STANDARD',
            expiresAt: expect.any(Date),
          }),
        }),
        expect.any(Object),
      );
    });
  });
});

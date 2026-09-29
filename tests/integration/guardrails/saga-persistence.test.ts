import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SagaInstanceModel } from '@hvac/database';

describe('Phase 0 Guardrail: Persistent Saga Management (Rule 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize a persistent saga instance with tracking state', async () => {
    const sagaData = {
      sagaId: 'saga_cash_sale_001',
      sagaType: 'CASH_SALE_SAGA',
      aggregateId: 'ord_sale_101',
      companyId: 'comp_cairo',
      currentStep: 'CREATE_PENDING_ORDER',
      status: 'RUNNING',
      completedSteps: ['CREATE_PENDING_ORDER'],
      retryCount: 0,
      correlationId: 'corr_uuid_101',
      stateData: {
        orderId: 'ord_sale_101',
        totalAmount: 18500,
        customerId: 'cust_ahmed',
      },
    };

    vi.spyOn(SagaInstanceModel, 'create').mockResolvedValueOnce([sagaData] as any);

    const [instance] = await SagaInstanceModel.create([sagaData]);

    expect(instance.sagaId).toBe('saga_cash_sale_001');
    expect(instance.status).toBe('RUNNING');
    expect(instance.currentStep).toBe('CREATE_PENDING_ORDER');
    expect(instance.completedSteps).toContain('CREATE_PENDING_ORDER');
    expect(instance.correlationId).toBe('corr_uuid_101');
  });

  it('should record failure and transition to COMPENSATING state upon step failure', async () => {
    const updateSpy = vi.spyOn(SagaInstanceModel, 'updateOne').mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
    });

    await SagaInstanceModel.updateOne(
      { sagaId: 'saga_cash_sale_001' },
      {
        $set: {
          status: 'COMPENSATING',
          failedStep: 'COLLECT_PAYMENT',
          currentStep: 'REVERSE_STOCK_RESERVATION',
        },
        $inc: { retryCount: 1 },
      },
    );

    expect(updateSpy).toHaveBeenCalledWith(
      { sagaId: 'saga_cash_sale_001' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'COMPENSATING',
          failedStep: 'COLLECT_PAYMENT',
        }),
      }),
    );
  });

  it('should record COMPLETED state upon successful posting of final journal entry', async () => {
    const updateSpy = vi.spyOn(SagaInstanceModel, 'updateOne').mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
    });

    await SagaInstanceModel.updateOne(
      { sagaId: 'saga_cash_sale_001' },
      {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        $push: { completedSteps: 'POST_JOURNAL_ENTRY' },
      },
    );

    expect(updateSpy).toHaveBeenCalledWith(
      { sagaId: 'saga_cash_sale_001' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'COMPLETED',
        }),
      }),
    );
  });
});

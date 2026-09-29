import { describe, it, expect } from 'vitest';
import { StockReservedEvent, SaleCreatedEvent } from '@hvac/event-contracts';

describe('Phase 0 Guardrail: Event Contracts & Versioning Topology', () => {
  it('should correctly format versioned routingKey adhering to RabbitMQ topic exchange topology', () => {
    const event = new StockReservedEvent(
      {
        reservationId: 'res_001',
        orderId: 'ord_001',
        warehouseId: 'wh_main',
        items: [{ productId: 'prod_1.5hp', quantity: 2, serialNumbers: ['SN001', 'SN002'] }],
      },
      {
        companyId: 'comp_01',
        branchId: 'br_cairo',
        correlationId: 'corr_xyz123',
      },
    );

    expect(event.metadata.eventType).toBe('inventory.stock.reserved');
    expect(event.metadata.eventVersion).toBe(1);
    expect(event.metadata.routingKey).toBe('inventory.stock.reserved.v1');
    expect(event.metadata.companyId).toBe('comp_01');
    expect(event.metadata.correlationId).toBe('corr_xyz123');
  });

  it('should format sales order event with consistent schema', () => {
    const event = new SaleCreatedEvent(
      {
        orderId: 'ord_cash_101',
        orderNumber: 'SO-2026-0001',
        customerId: 'cust_ahmed',
        branchId: 'br_giza',
        saleType: 'CASH',
        totalAmount: 18500,
        items: [{ productId: 'prod_ac_3hp', quantity: 1, unitPrice: 18500 }],
      },
      {
        companyId: 'comp_01',
        branchId: 'br_giza',
      },
    );

    expect(event.metadata.eventType).toBe('sales.order.created');
    expect(event.metadata.eventVersion).toBe(1);
    expect(event.metadata.routingKey).toBe('sales.order.created.v1');
  });
});

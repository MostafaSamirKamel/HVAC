import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { SalesOrderModel } from '../../../apps/sales-service/src/modules/sales-orders/sales-order.model.js';
import { SalesOrderService } from '../../../apps/sales-service/src/modules/sales-orders/sales-order.service.js';
import { SalesInvoiceModel } from '../../../apps/sales-service/src/modules/sales-invoices/sales-invoice.model.js';
import { SalesInvoiceService } from '../../../apps/sales-service/src/modules/sales-invoices/sales-invoice.service.js';
import { PriceListModel } from '../../../apps/sales-service/src/modules/price-lists/price-list.model.js';
import { PriceListService } from '../../../apps/sales-service/src/modules/price-lists/price-list.service.js';
import {
  CashSaleSagaOrchestrator,
  CashSaleSagaInput,
  InventoryClientAdapter,
  FinanceClientAdapter,
} from '../../../apps/sales-service/src/sagas/cash-sale/cash-sale.saga.js';
import { SagaInstanceModel, OutboxEventModel } from '@hvac/database';

describe('Phase 3: Sales Service & Cash Sale Saga Orchestration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sales Orders & Exact Money Math', () => {
    it('should create pending sales order with exact decimal arithmetic (zero drift)', async () => {
      const mockOrder = {
        companyId: 'comp_cairo_hvac',
        orderId: 'ord_1001',
        orderNumber: 'SO-2026-1001',
        customerId: 'cust_mohamed_01',
        branchId: 'br_nasr_city',
        warehouseId: 'wh_nasr_city_01',
        saleType: 'CASH',
        status: 'PENDING',
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP Inverter',
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            discountAmount: mongoose.Types.Decimal128.fromString('500.00'),
            totalPrice: mongoose.Types.Decimal128.fromString('48500.00'),
            serialNumbers: ['SN001', 'SN002'],
          },
        ],
        totalAmount: mongoose.Types.Decimal128.fromString('49000.00'),
        discountAmount: mongoose.Types.Decimal128.fromString('500.00'),
        taxAmount: mongoose.Types.Decimal128.fromString('0.00'),
        netAmount: mongoose.Types.Decimal128.fromString('48500.00'),
        salesRepresentativeId: 'usr_sales_ahmed',
      };

      vi.spyOn(SalesOrderModel, 'create').mockResolvedValueOnce([mockOrder] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const order = await SalesOrderService.createPendingOrder({
        companyId: 'comp_cairo_hvac',
        customerId: 'cust_mohamed_01',
        branchId: 'br_nasr_city',
        warehouseId: 'wh_nasr_city_01',
        saleType: 'CASH',
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP Inverter',
            quantity: 2,
            unitPrice: '24500.00',
            discountAmount: '500.00',
            serialNumbers: ['SN001', 'SN002'],
          },
        ],
        salesRepresentativeId: 'usr_sales_ahmed',
      });

      expect(order.orderNumber).toBe('SO-2026-1001');
      expect(order.status).toBe('PENDING');
      expect(order.netAmount.toString()).toBe('48500.00');
    });
  });

  describe('Commercial Invoices (Rule 11)', () => {
    it('should generate draft commercial invoice from sales order', async () => {
      const mockOrder = {
        companyId: 'comp_cairo_hvac',
        orderId: 'ord_1001',
        customerId: 'cust_mohamed_01',
        branchId: 'br_nasr_city',
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP Inverter',
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            totalPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            serialNumbers: ['SN001'],
          },
        ],
        totalAmount: mongoose.Types.Decimal128.fromString('24500.00'),
        taxAmount: mongoose.Types.Decimal128.fromString('0.00'),
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
      };

      const mockInvoice = {
        companyId: 'comp_cairo_hvac',
        invoiceId: 'inv_2001',
        invoiceNumber: 'INV-2026-2001',
        orderId: 'ord_1001',
        status: 'DRAFT',
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
      };

      vi.spyOn(SalesInvoiceModel, 'create').mockResolvedValueOnce([mockInvoice] as any);

      const invoice = await SalesInvoiceService.createDraftInvoice(mockOrder as any);

      expect(invoice.invoiceId).toBe('inv_2001');
      expect(invoice.invoiceNumber).toBe('INV-2026-2001');
      expect(invoice.status).toBe('DRAFT');
    });
  });

  describe('Price Lists (Rule 12)', () => {
    it('should create price list with Decimal128 items', async () => {
      const mockPl = {
        companyId: 'comp_cairo_hvac',
        priceListId: 'pl_wholesale_01',
        name: 'قائمة أسعار الجملة',
        currency: 'EGP',
        items: [
          {
            productId: 'prod_carrier_2.25',
            price: mongoose.Types.Decimal128.fromString('21000.00'),
            minQuantity: 5,
          },
        ],
        isDefault: false,
        isActive: true,
      };

      vi.spyOn(PriceListModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(PriceListModel, 'create').mockResolvedValueOnce(mockPl as any);

      const created = await PriceListService.createPriceList({
        companyId: 'comp_cairo_hvac',
        name: 'قائمة أسعار الجملة',
        items: [{ productId: 'prod_carrier_2.25', price: '21000.00', minQuantity: 5 }],
      });

      expect(created.name).toBe('قائمة أسعار الجملة');
      expect(created.items[0].price.toString()).toBe('21000.00');
    });
  });

  describe('Cash Sale Saga Orchestrator (Rule 6 & Rule 7)', () => {
    it('should successfully orchestrate the full 7-step Cash Sale Saga and persist COMPLETED state', async () => {
      // Mock persistent saga tracking
      vi.spyOn(SagaInstanceModel, 'create').mockResolvedValueOnce({} as any);
      vi.spyOn(SagaInstanceModel, 'updateOne').mockResolvedValue({} as any);

      // Mock Step 1: Create Order
      const mockOrder = {
        companyId: 'comp_cairo_hvac',
        orderId: 'ord_1001',
        orderNumber: 'SO-2026-1001',
        totalAmount: mongoose.Types.Decimal128.fromString('24500.00'),
        taxAmount: mongoose.Types.Decimal128.fromString('0.00'),
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP',
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            totalPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            serialNumbers: ['SN_TEST_01'],
          },
        ],
      };
      vi.spyOn(SalesOrderService, 'createPendingOrder').mockResolvedValueOnce(mockOrder as any);
      vi.spyOn(SalesOrderService, 'updateOrderStatus').mockResolvedValue({} as any);

      // Mock Step 2: Reserve Stock
      const mockInventoryAdapter: InventoryClientAdapter = {
        reserveStock: vi.fn().mockResolvedValue({ reservationId: 'res_001' }),
        releaseReservation: vi.fn().mockResolvedValue(undefined),
        confirmDeduction: vi.fn().mockResolvedValue({ deductionId: 'ded_001' }),
        compensateSaleDeduction: vi.fn().mockResolvedValue(undefined),
      };

      // Mock Step 3: Create Draft Invoice
      const mockInvoice = {
        companyId: 'comp_cairo_hvac',
        invoiceId: 'inv_001',
        invoiceNumber: 'INV-2026-001',
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
      };
      vi.spyOn(SalesInvoiceService, 'createDraftInvoice').mockResolvedValueOnce(mockInvoice as any);
      vi.spyOn(SalesInvoiceService, 'markInvoicePaid').mockResolvedValueOnce({} as any);
      vi.spyOn(SalesInvoiceService, 'markInvoicePosted').mockResolvedValueOnce({} as any);

      // Mock Step 4 & 6: Finance Adapter
      const mockFinanceAdapter: FinanceClientAdapter = {
        collectPayment: vi.fn().mockResolvedValue({ paymentId: 'pay_001', receiptNumber: 'REC-001' }),
        refundPayment: vi.fn().mockResolvedValue({ refundId: 'ref_001' }),
        postJournalEntry: vi.fn().mockResolvedValue({ journalEntryId: 'je_001' }),
      };

      const orchestrator = new CashSaleSagaOrchestrator(
        mockInventoryAdapter,
        mockFinanceAdapter,
      );

      const sagaInput: CashSaleSagaInput = {
        companyId: 'comp_cairo_hvac',
        customerId: 'cust_ahmed',
        branchId: 'br_nasr_city',
        warehouseId: 'wh_nasr_city_01',
        saleType: 'CASH',
        paymentMethod: 'CASH',
        treasuryId: 'tr_cairo_cash_01',
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP',
            quantity: 1,
            unitPrice: '24500.00',
            serialNumbers: ['SN_TEST_01'],
          },
        ],
        salesRepresentativeId: 'usr_sales_ahmed',
      };

      const result = await orchestrator.execute(sagaInput);

      expect(result.status).toBe('COMPLETED');
      expect(result.orderId).toBe('ord_1001');
      expect(result.invoiceId).toBe('inv_001');
      expect(result.completedSteps).toHaveLength(7);
      expect(mockInventoryAdapter.reserveStock).toHaveBeenCalled();
      expect(mockFinanceAdapter.collectPayment).toHaveBeenCalled();
      expect(mockInventoryAdapter.confirmDeduction).toHaveBeenCalled();
      expect(mockFinanceAdapter.postJournalEntry).toHaveBeenCalled();
    });

    it('should trigger cascading idempotent compensation if Step 6 (Journal Posting) fails (Rule 6)', async () => {
      vi.spyOn(SagaInstanceModel, 'create').mockResolvedValueOnce({} as any);
      const sagaUpdateSpy = vi.spyOn(SagaInstanceModel, 'updateOne').mockResolvedValue({} as any);

      const mockOrder = {
        companyId: 'comp_cairo_hvac',
        orderId: 'ord_1001',
        orderNumber: 'SO-2026-1001',
        totalAmount: mongoose.Types.Decimal128.fromString('24500.00'),
        taxAmount: mongoose.Types.Decimal128.fromString('0.00'),
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP',
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            totalPrice: mongoose.Types.Decimal128.fromString('24500.00'),
            serialNumbers: ['SN_TEST_01'],
          },
        ],
      };
      vi.spyOn(SalesOrderService, 'createPendingOrder').mockResolvedValueOnce(mockOrder as any);
      vi.spyOn(SalesOrderService, 'updateOrderStatus').mockResolvedValue({} as any);

      const mockInvoice = {
        companyId: 'comp_cairo_hvac',
        invoiceId: 'inv_001',
        invoiceNumber: 'INV-2026-001',
        netAmount: mongoose.Types.Decimal128.fromString('24500.00'),
      };
      vi.spyOn(SalesInvoiceService, 'createDraftInvoice').mockResolvedValueOnce(mockInvoice as any);
      vi.spyOn(SalesInvoiceService, 'markInvoicePaid').mockResolvedValueOnce({} as any);
      const voidInvoiceSpy = vi.spyOn(SalesInvoiceService, 'voidInvoice').mockResolvedValueOnce({} as any);

      const mockInventoryAdapter: InventoryClientAdapter = {
        reserveStock: vi.fn().mockResolvedValue({ reservationId: 'res_001' }),
        releaseReservation: vi.fn().mockResolvedValue(undefined),
        confirmDeduction: vi.fn().mockResolvedValue({ deductionId: 'ded_001' }),
        compensateSaleDeduction: vi.fn().mockResolvedValue(undefined),
      };

      const mockFinanceAdapter: FinanceClientAdapter = {
        collectPayment: vi.fn().mockResolvedValue({ paymentId: 'pay_001', receiptNumber: 'REC-001' }),
        refundPayment: vi.fn().mockResolvedValue({ refundId: 'ref_001' }),
        // Step 6 fails: Journal entry posting throws error
        postJournalEntry: vi.fn().mockRejectedValue(new Error('General Ledger unbalance error')),
      };

      const orchestrator = new CashSaleSagaOrchestrator(
        mockInventoryAdapter,
        mockFinanceAdapter,
      );

      const sagaInput: CashSaleSagaInput = {
        companyId: 'comp_cairo_hvac',
        customerId: 'cust_ahmed',
        branchId: 'br_nasr_city',
        warehouseId: 'wh_nasr_city_01',
        saleType: 'CASH',
        paymentMethod: 'CASH',
        treasuryId: 'tr_cairo_cash_01',
        items: [
          {
            productId: 'prod_carrier_2.25',
            productName: 'Carrier 2.25 HP',
            quantity: 1,
            unitPrice: '24500.00',
            serialNumbers: ['SN_TEST_01'],
          },
        ],
        salesRepresentativeId: 'usr_sales_ahmed',
      };

      await expect(orchestrator.execute(sagaInput)).rejects.toThrow('General Ledger unbalance error');

      // 1. Verifies reverse stock movement & restore serials was executed
      expect(mockInventoryAdapter.compensateSaleDeduction).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp_cairo_hvac',
          orderId: 'ord_1001',
          invoiceId: 'inv_001',
        }),
      );

      // 2. Verifies payment refund was executed
      expect(mockFinanceAdapter.refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp_cairo_hvac',
          paymentId: 'pay_001',
        }),
      );

      // 3. Verifies invoice was voided
      expect(voidInvoiceSpy).toHaveBeenCalledWith(
        'comp_cairo_hvac',
        'inv_001',
        expect.any(String),
      );

      // 4. Verifies Saga state was transitioned to FAILED
      expect(sagaUpdateSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });
  });
});

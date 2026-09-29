import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { SupplierModel } from '../../../apps/purchasing-service/src/modules/suppliers/supplier.model.js';
import { SupplierService } from '../../../apps/purchasing-service/src/modules/suppliers/supplier.service.js';
import { PurchaseOrderModel } from '../../../apps/purchasing-service/src/modules/purchase-orders/purchase-order.model.js';
import { PurchaseOrderService } from '../../../apps/purchasing-service/src/modules/purchase-orders/purchase-order.service.js';
import { GoodsReceiptModel } from '../../../apps/purchasing-service/src/modules/goods-receipts/goods-receipt.model.js';
import { GoodsReceiptService } from '../../../apps/purchasing-service/src/modules/goods-receipts/goods-receipt.service.js';
import { VendorBillModel } from '../../../apps/purchasing-service/src/modules/vendor-invoices/vendor-bill.model.js';
import { VendorBillService } from '../../../apps/purchasing-service/src/modules/vendor-invoices/vendor-bill.service.js';
import { PurchaseReturnModel } from '../../../apps/purchasing-service/src/modules/purchase-returns/purchase-return.model.js';
import { PurchaseReturnService } from '../../../apps/purchasing-service/src/modules/purchase-returns/purchase-return.service.js';
import { PurchaseRequestModel } from '../../../apps/purchasing-service/src/modules/purchase-requests/purchase-request.model.js';
import { PurchaseRequestService } from '../../../apps/purchasing-service/src/modules/purchase-requests/purchase-request.service.js';
import { RFQModel } from '../../../apps/purchasing-service/src/modules/rfqs/rfq.model.js';
import { RFQService } from '../../../apps/purchasing-service/src/modules/rfqs/rfq.service.js';
import { OutboxEventModel } from '@hvac/database';
import { ValidationError, ConflictError } from '@hvac/errors';

describe('Phase 5: Purchasing & Procurement Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';
  const warehouseId = 'wh_nasr_city_01';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Suppliers & Multi-tenant Boundaries', () => {
    it('should create supplier with payment terms and credit limit in Decimal128', async () => {
      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
        code: 'SUP-CARRIER',
        name: 'Miraco Carrier Egypt',
        phone: '+201001234567',
        paymentTermsDays: 45,
        currency: 'EGP',
        creditLimit: mongoose.Types.Decimal128.fromString('1000000.00'),
        isActive: true,
      };

      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(SupplierModel, 'create').mockResolvedValueOnce([mockSupplier] as any);

      const supplier = await SupplierService.createSupplier({
        companyId,
        code: 'SUP-CARRIER',
        name: 'Miraco Carrier Egypt',
        phone: '+201001234567',
        paymentTermsDays: 45,
        creditLimit: '1000000.00',
      });

      expect(supplier.code).toBe('SUP-CARRIER');
      expect(supplier.creditLimit.toString()).toBe('1000000.00');
    });

    it('should reject duplicate supplier code for the same company', async () => {
      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce({ code: 'SUP-CARRIER' } as any);

      await expect(
        SupplierService.createSupplier({
          companyId,
          code: 'SUP-CARRIER',
          name: 'Duplicate Carrier',
          phone: '+201001234567',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Purchase Orders & Exact Money Math', () => {
    it('should create purchase order with zero-drift money math and emit outbox event', async () => {
      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
        name: 'Carrier Egypt',
      };

      const mockOrder = {
        companyId,
        purchaseOrderId: 'po_1001',
        orderNumber: 'PO-2026-1001',
        supplierId: 'sup_carrier_01',
        branchId,
        warehouseId,
        status: 'DRAFT',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 10,
            receivedQuantity: 0,
            unitCost: mongoose.Types.Decimal128.fromString('18500.00'),
            totalCost: mongoose.Types.Decimal128.fromString('185000.00'),
          },
        ],
        totalAmount: mongoose.Types.Decimal128.fromString('185000.00'),
        currency: 'EGP',
      };

      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(mockSupplier as any);
      vi.spyOn(PurchaseOrderModel, 'create').mockResolvedValueOnce([mockOrder] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const order = await PurchaseOrderService.createOrder({
        companyId,
        supplierId: 'sup_carrier_01',
        branchId,
        warehouseId,
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 10,
            unitCost: '18500.00',
          },
        ],
        createdBy: 'usr_buyer_hassan',
      });

      expect(order.status).toBe('DRAFT');
      expect(order.totalAmount.toString()).toBe('185000.00');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should approve a purchase order transitioning to APPROVED status', async () => {
      const mockOrder: any = {
        companyId,
        purchaseOrderId: 'po_1001',
        status: 'DRAFT',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PurchaseOrderModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockOrder),
      } as any);

      const approved = await PurchaseOrderService.approveOrder(
        companyId,
        'po_1001',
        'usr_procurement_manager'
      );

      expect(approved.status).toBe('APPROVED');
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });

  describe('Goods Receipt Note (GRN) & Warehouse Reception', () => {
    it('should receive physical goods against approved PO, validate serial numbers, and emit GRN event', async () => {
      const mockOrder: any = {
        companyId,
        purchaseOrderId: 'po_1001',
        orderNumber: 'PO-2026-1001',
        supplierId: 'sup_carrier_01',
        warehouseId,
        branchId,
        status: 'APPROVED',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 2,
            receivedQuantity: 0,
            unitCost: mongoose.Types.Decimal128.fromString('18500.00'),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockReceipt = {
        companyId,
        goodsReceiptId: 'grn_1001',
        receiptNumber: 'GRN-2026-1001',
        purchaseOrderId: 'po_1001',
        status: 'RECEIVED',
        items: [
          {
            productId: 'prod_carrier_1.5',
            receivedQuantity: 2,
            unitCost: mongoose.Types.Decimal128.fromString('18500.00'),
            serialNumbers: ['SN-CR-001', 'SN-CR-002'],
          },
        ],
      };

      vi.spyOn(PurchaseOrderModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockOrder),
      } as any);
      vi.spyOn(GoodsReceiptModel, 'create').mockResolvedValueOnce([mockReceipt] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const receipt = await GoodsReceiptService.receiveGoods({
        companyId,
        purchaseOrderId: 'po_1001',
        items: [
          {
            productId: 'prod_carrier_1.5',
            receivedQuantity: 2,
            unitCost: '18500.00',
            serialNumbers: ['SN-CR-001', 'SN-CR-002'],
          },
        ],
        receivedBy: 'usr_wh_keeper_tariq',
      });

      expect(receipt.status).toBe('RECEIVED');
      expect(mockOrder.status).toBe('RECEIVED'); // Fully received
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject goods receipt if serial numbers count does not match received quantity', async () => {
      const mockOrder: any = {
        companyId,
        purchaseOrderId: 'po_1001',
        status: 'APPROVED',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 5,
            receivedQuantity: 0,
          },
        ],
      };

      vi.spyOn(PurchaseOrderModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockOrder),
      } as any);

      await expect(
        GoodsReceiptService.receiveGoods({
          companyId,
          purchaseOrderId: 'po_1001',
          items: [
            {
              productId: 'prod_carrier_1.5',
              receivedQuantity: 3,
              unitCost: '18500.00',
              serialNumbers: ['SN-CR-001'], // 1 serial for 3 items
            },
          ],
          receivedBy: 'usr_wh_keeper_tariq',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Vendor Bills (Rule 11: Purchasing Owns Vendor Bills)', () => {
    it('should create vendor bill with tax and discount math and emit outbox event for finance AP posting', async () => {
      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
        paymentTermsDays: 30,
      };

      const mockBill = {
        companyId,
        vendorBillId: 'bill_1001',
        billNumber: 'VB-2026-1001',
        supplierId: 'sup_carrier_01',
        status: 'DRAFT',
        subtotal: mongoose.Types.Decimal128.fromString('185000.00'),
        taxAmount: mongoose.Types.Decimal128.fromString('25900.00'), // 14% VAT
        discountAmount: mongoose.Types.Decimal128.fromString('5000.00'),
        netAmount: mongoose.Types.Decimal128.fromString('205900.00'),
        currency: 'EGP',
      };

      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(mockSupplier as any);
      vi.spyOn(VendorBillModel, 'create').mockResolvedValueOnce([mockBill] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const bill = await VendorBillService.createBill({
        companyId,
        supplierId: 'sup_carrier_01',
        branchId,
        taxAmount: '25900.00',
        discountAmount: '5000.00',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 10,
            unitCost: '18500.00',
          },
        ],
        createdBy: 'usr_accountant_ali',
      });

      expect(bill.status).toBe('DRAFT');
      expect(bill.netAmount.toString()).toBe('205900.00');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should transition vendor bill to POSTED and mark PAID', async () => {
      const mockBill: any = {
        companyId,
        vendorBillId: 'bill_1001',
        status: 'DRAFT',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(VendorBillModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockBill),
      } as any);

      const posted = await VendorBillService.postBill(companyId, 'bill_1001');
      expect(posted.status).toBe('POSTED');

      vi.spyOn(VendorBillModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockBill),
      } as any);

      const paid = await VendorBillService.markPaid(companyId, 'bill_1001');
      expect(paid.status).toBe('PAID');
    });
  });

  describe('Purchase Returns (Return to Vendor - RTV)', () => {
    it('should create purchase return in DRAFT status with zero-drift money calculations', async () => {
      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
        name: 'Miraco Carrier Egypt',
      };

      const mockReturn = {
        companyId,
        branchId,
        warehouseId,
        returnId: 'rtv_1001',
        returnNumber: 'RTV-2026-1001',
        supplierId: 'sup_carrier_01',
        status: 'DRAFT',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 2,
            unitCost: mongoose.Types.Decimal128.fromString('18500.00'),
            totalCost: mongoose.Types.Decimal128.fromString('37000.00'),
            serialNumbers: ['SN-DEF-001', 'SN-DEF-002'],
            reason: 'Factory Defect - Compressor Failure',
          },
        ],
        totalAmount: mongoose.Types.Decimal128.fromString('37000.00'),
        currency: 'EGP',
        returnedBy: 'usr_wh_keeper_tariq',
      };

      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(mockSupplier as any);
      vi.spyOn(PurchaseReturnModel, 'create').mockResolvedValueOnce([mockReturn] as any);

      const pReturn = await PurchaseReturnService.createReturn({
        companyId,
        branchId,
        warehouseId,
        supplierId: 'sup_carrier_01',
        items: [
          {
            productId: 'prod_carrier_1.5',
            productName: 'Carrier 1.5 HP Optimax',
            quantity: 2,
            unitCost: '18500.00',
            serialNumbers: ['SN-DEF-001', 'SN-DEF-002'],
            reason: 'Factory Defect - Compressor Failure',
          },
        ],
        returnedBy: 'usr_wh_keeper_tariq',
      });

      expect(pReturn.status).toBe('DRAFT');
      expect(pReturn.totalAmount.toString()).toBe('37000.00');
      expect(pReturn.items[0].serialNumbers).toHaveLength(2);
    });

    it('should reject purchase return when serial numbers count does not match returned quantity', async () => {
      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
      };

      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(mockSupplier as any);

      await expect(
        PurchaseReturnService.createReturn({
          companyId,
          branchId,
          warehouseId,
          supplierId: 'sup_carrier_01',
          items: [
            {
              productId: 'prod_carrier_1.5',
              productName: 'Carrier 1.5 HP Optimax',
              quantity: 2,
              unitCost: '18500.00',
              serialNumbers: ['SN-DEF-001'], // 1 serial for 2 items
              reason: 'Defective unit',
            },
          ],
          returnedBy: 'usr_wh_keeper_tariq',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should approve purchase return and emit purchasing.return.created event via outbox', async () => {
      const mockReturn: any = {
        companyId,
        branchId,
        warehouseId,
        returnId: 'rtv_1001',
        returnNumber: 'RTV-2026-1001',
        supplierId: 'sup_carrier_01',
        status: 'DRAFT',
        currency: 'EGP',
        totalAmount: mongoose.Types.Decimal128.fromString('37000.00'),
        items: [
          {
            productId: 'prod_carrier_1.5',
            quantity: 2,
            unitCost: mongoose.Types.Decimal128.fromString('18500.00'),
            serialNumbers: ['SN-DEF-001', 'SN-DEF-002'],
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PurchaseReturnModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockReturn),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const approved = await PurchaseReturnService.approveReturn(
        companyId,
        'rtv_1001',
        'usr_procurement_manager'
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe('usr_procurement_manager');
      expect(mockReturn.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Purchase Requests (Internal Requisitions / طلبات الشراء الداخلية)', () => {
    it('should create purchase request in SUBMITTED status and emit purchasing.request.created event', async () => {
      const mockRequest = {
        companyId,
        branchId,
        requestId: 'pr_1001',
        requestNumber: 'PR-2026-1001',
        department: 'MAINTENANCE',
        requestedBy: 'usr_tech_lead',
        priority: 'HIGH',
        status: 'SUBMITTED',
        items: [
          {
            productId: 'prod_copper_pipe_05',
            productName: 'Copper Pipe 1/2 inch (Roll)',
            requestedQuantity: 5,
            estimatedUnitCost: mongoose.Types.Decimal128.fromString('1200.00'),
            estimatedTotalCost: mongoose.Types.Decimal128.fromString('6000.00'),
            purpose: 'Site installation project',
          },
        ],
        totalEstimatedAmount: mongoose.Types.Decimal128.fromString('6000.00'),
        currency: 'EGP',
      };

      vi.spyOn(PurchaseRequestModel, 'create').mockResolvedValueOnce([mockRequest] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const request = await PurchaseRequestService.createRequest({
        companyId,
        branchId,
        department: 'MAINTENANCE',
        requestedBy: 'usr_tech_lead',
        priority: 'HIGH',
        items: [
          {
            productId: 'prod_copper_pipe_05',
            productName: 'Copper Pipe 1/2 inch (Roll)',
            requestedQuantity: 5,
            estimatedUnitCost: '1200.00',
            purpose: 'Site installation project',
          },
        ],
      });

      expect(request.status).toBe('SUBMITTED');
      expect(request.totalEstimatedAmount.toString()).toBe('6000.00');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should approve purchase request and emit purchasing.request.approved event', async () => {
      const mockRequest: any = {
        companyId,
        branchId,
        requestId: 'pr_1001',
        requestNumber: 'PR-2026-1001',
        status: 'SUBMITTED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PurchaseRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const approved = await PurchaseRequestService.approveRequest(
        companyId,
        'pr_1001',
        'usr_operations_manager'
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe('usr_operations_manager');
      expect(mockRequest.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject purchase request with rejection reason', async () => {
      const mockRequest: any = {
        companyId,
        requestId: 'pr_1001',
        status: 'SUBMITTED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PurchaseRequestModel, 'findOne').mockResolvedValueOnce(mockRequest);

      const rejected = await PurchaseRequestService.rejectRequest(
        companyId,
        'pr_1001',
        'usr_operations_manager',
        'Budget exceeded for current quarter'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Budget exceeded for current quarter');
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should convert approved purchase request into purchase order', async () => {
      const mockRequest: any = {
        companyId,
        branchId,
        requestId: 'pr_1001',
        requestNumber: 'PR-2026-1001',
        status: 'APPROVED',
        currency: 'EGP',
        notes: 'Urgent for commercial tower HVAC project',
        items: [
          {
            productId: 'prod_copper_pipe_05',
            productName: 'Copper Pipe 1/2 inch (Roll)',
            requestedQuantity: 5,
            estimatedUnitCost: mongoose.Types.Decimal128.fromString('1200.00'),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockPO: any = {
        companyId,
        purchaseOrderId: 'po_2002',
        orderNumber: 'PO-2026-2002',
        supplierId: 'sup_copper_egypt',
        status: 'DRAFT',
      };

      vi.spyOn(PurchaseRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);
      vi.spyOn(PurchaseOrderService, 'createOrder').mockResolvedValueOnce(mockPO);

      const result = await PurchaseRequestService.convertToPO(
        companyId,
        'pr_1001',
        'sup_copper_egypt',
        warehouseId,
        'usr_buyer_hassan'
      );

      expect(result.request.status).toBe('CONVERTED_TO_PO');
      expect(result.request.purchaseOrderId).toBe('po_2002');
      expect(result.purchaseOrder.purchaseOrderId).toBe('po_2002');
      expect(mockRequest.save).toHaveBeenCalled();
    });
  });

  describe('Request For Quotation (RFQ / طلب عروض أسعار الموردين)', () => {
    it('should create RFQ in DRAFT status with target unit costs', async () => {
      const mockRFQ = {
        companyId,
        branchId,
        rfqId: 'rfq_1001',
        rfqNumber: 'RFQ-2026-1001',
        title: 'Central HVAC Chillers Procurement',
        status: 'DRAFT',
        items: [
          {
            productId: 'prod_chiller_50tr',
            productName: 'Carrier 50TR Air-Cooled Chiller',
            quantity: 2,
            targetUnitCost: mongoose.Types.Decimal128.fromString('450000.00'),
          },
        ],
        invitedSuppliers: ['sup_carrier_01'],
        quotations: [],
        createdBy: 'usr_buyer_hassan',
      };

      vi.spyOn(SupplierModel, 'countDocuments').mockResolvedValueOnce(1 as any);
      vi.spyOn(RFQModel, 'create').mockResolvedValueOnce([mockRFQ] as any);

      const rfq = await RFQService.createRFQ({
        companyId,
        branchId,
        title: 'Central HVAC Chillers Procurement',
        invitedSuppliers: ['sup_carrier_01'],
        createdBy: 'usr_buyer_hassan',
        items: [
          {
            productId: 'prod_chiller_50tr',
            productName: 'Carrier 50TR Air-Cooled Chiller',
            quantity: 2,
            targetUnitCost: '450000.00',
          },
        ],
      });

      expect(rfq.status).toBe('DRAFT');
      expect(rfq.rfqNumber).toBe('RFQ-2026-1001');
      expect(rfq.items[0].quantity).toBe(2);
    });

    it('should add supplier quotation with calculated item totals and overall sum', async () => {
      const mockRFQ: any = {
        companyId,
        rfqId: 'rfq_1001',
        status: 'DRAFT',
        items: [
          {
            productId: 'prod_chiller_50tr',
            productName: 'Carrier 50TR Air-Cooled Chiller',
            quantity: 2,
          },
        ],
        quotations: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockSupplier = {
        companyId,
        supplierId: 'sup_carrier_01',
        name: 'Miraco Carrier Egypt',
        paymentTermsDays: 60,
      };

      vi.spyOn(RFQModel, 'findOne').mockResolvedValueOnce(mockRFQ);
      vi.spyOn(SupplierModel, 'findOne').mockResolvedValueOnce(mockSupplier as any);

      const updated = await RFQService.addSupplierQuotation({
        companyId,
        rfqId: 'rfq_1001',
        supplierId: 'sup_carrier_01',
        quotationReference: 'CARRIER-QT-2026-88',
        currency: 'EGP',
        items: [
          {
            productId: 'prod_chiller_50tr',
            unitCost: '440000.00',
            leadTimeDays: 14,
          },
        ],
      });

      expect(updated.status).toBe('SENT');
      expect(updated.quotations).toHaveLength(1);
      expect(updated.quotations[0].totalAmount.toString()).toBe('880000.00');
      expect(updated.quotations[0].supplierName).toBe('Miraco Carrier Egypt');
      expect(mockRFQ.save).toHaveBeenCalled();
    });

    it('should award quotation and automatically generate official Purchase Order', async () => {
      const mockRFQ: any = {
        companyId,
        branchId,
        rfqId: 'rfq_1001',
        rfqNumber: 'RFQ-2026-1001',
        title: 'Central HVAC Chillers Procurement',
        status: 'SENT',
        items: [
          {
            productId: 'prod_chiller_50tr',
            productName: 'Carrier 50TR Air-Cooled Chiller',
            quantity: 2,
          },
        ],
        quotations: [
          {
            quotationId: 'quote_999',
            supplierId: 'sup_carrier_01',
            supplierName: 'Miraco Carrier Egypt',
            currency: 'EGP',
            isAwarded: false,
            items: [
              {
                productId: 'prod_chiller_50tr',
                unitCost: mongoose.Types.Decimal128.fromString('440000.00'),
                totalCost: mongoose.Types.Decimal128.fromString('880000.00'),
              },
            ],
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockPO: any = {
        companyId,
        purchaseOrderId: 'po_3003',
        orderNumber: 'PO-2026-3003',
        supplierId: 'sup_carrier_01',
        status: 'DRAFT',
      };

      vi.spyOn(RFQModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRFQ),
      } as any);
      vi.spyOn(PurchaseOrderService, 'createOrder').mockResolvedValueOnce(mockPO);

      const result = await RFQService.awardQuotation(
        companyId,
        'rfq_1001',
        'quote_999',
        warehouseId,
        'usr_procurement_director'
      );

      expect(result.rfq.status).toBe('AWARDED');
      expect(result.rfq.awardedSupplierId).toBe('sup_carrier_01');
      expect(result.rfq.awardedPurchaseOrderId).toBe('po_3003');
      expect(result.purchaseOrder.purchaseOrderId).toBe('po_3003');
      expect(mockRFQ.save).toHaveBeenCalled();
    });
  });
});

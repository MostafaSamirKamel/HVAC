import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ProductModel } from '../../../apps/inventory-service/src/modules/products/product.model.js';
import { ProductService } from '../../../apps/inventory-service/src/modules/products/product.service.js';
import { WarehouseModel } from '../../../apps/inventory-service/src/modules/warehouses/warehouse.model.js';
import { WarehouseService } from '../../../apps/inventory-service/src/modules/warehouses/warehouse.service.js';
import { SerialNumberModel } from '../../../apps/inventory-service/src/modules/serial-numbers/serial-number.model.js';
import { StockBalanceModel } from '../../../apps/inventory-service/src/modules/stock-balances/stock-balance.model.js';
import { StockMovementModel } from '../../../apps/inventory-service/src/modules/stock-movements/stock-movement.model.js';
import { StockReservationService } from '../../../apps/inventory-service/src/modules/stock-reservations/stock-reservation.service.js';
import { OutboxEventModel } from '@hvac/database';
import { ConflictError } from '@hvac/errors';

describe('Phase 2: Inventory & Serial Tracking Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Catalog & Products with Decimal128 (Rule 10 & 12)', () => {
    it('should create product with exact Decimal128 base and cost prices', async () => {
      const mockCreated = {
        productId: 'prod_carrier_2.25',
        companyId: 'comp_cairo_hvac',
        sku: 'CAR-2.25-INV',
        name: 'Carrier Inverter 2.25 HP',
        brand: 'Carrier',
        category: 'Split Inverter',
        coolingCapacityBtu: 18000,
        horsepower: '2.25 HP',
        refrigerantType: 'R410A',
        basePrice: mongoose.Types.Decimal128.fromString('24500.00'),
        costPrice: mongoose.Types.Decimal128.fromString('19800.50'),
        isSerialized: true,
        minStockLevel: 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(ProductModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(ProductModel, 'create').mockResolvedValueOnce([mockCreated] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await ProductService.createProduct({
        companyId: 'comp_cairo_hvac',
        sku: 'car-2.25-inv', // testing uppercase normalization
        name: 'Carrier Inverter 2.25 HP',
        brand: 'Carrier',
        category: 'Split Inverter',
        coolingCapacityBtu: 18000,
        horsepower: '2.25 HP',
        basePrice: '24500.00',
        costPrice: '19800.50',
        isSerialized: true,
      });

      expect(result.productId).toBe('prod_carrier_2.25');
      expect(result.basePrice).toBe('24500.00');
      expect(result.costPrice).toBe('19800.50');
      expect(result.isSerialized).toBe(true);
    });

    it('should reject duplicate SKU within the same company (Rule 5)', async () => {
      vi.spyOn(ProductModel, 'findOne').mockResolvedValueOnce({
        sku: 'CAR-2.25-INV',
        companyId: 'comp_cairo_hvac',
      } as any);

      await expect(
        ProductService.createProduct({
          companyId: 'comp_cairo_hvac',
          sku: 'CAR-2.25-INV',
          name: 'Carrier Duplicate',
          brand: 'Carrier',
          category: 'Split',
          basePrice: '24000',
          costPrice: '19000',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Warehouses with Tenant Isolation', () => {
    it('should create warehouse scoped to company and branch', async () => {
      const mockWh = {
        companyId: 'comp_cairo_hvac',
        warehouseId: 'wh_nasr_city_01',
        code: 'WH-NASR-01',
        name: 'مخزن مدينة نصر الرئيسي',
        branchId: 'br_nasr_city',
        isDefault: true,
        isActive: true,
      };

      vi.spyOn(WarehouseModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(WarehouseModel, 'updateMany').mockResolvedValueOnce({} as any);
      vi.spyOn(WarehouseModel, 'create').mockResolvedValueOnce(mockWh as any);

      const created = await WarehouseService.createWarehouse({
        companyId: 'comp_cairo_hvac',
        code: 'wh-nasr-01',
        name: 'مخزن مدينة نصر الرئيسي',
        branchId: 'br_nasr_city',
        isDefault: true,
      });

      expect(created.code).toBe('WH-NASR-01');
      expect(created.branchId).toBe('br_nasr_city');
      expect(created.isDefault).toBe(true);
    });
  });

  describe('Atomic Stock Reservations & Serial Tracking (Rule 3 & 9)', () => {
    it('should atomically reserve stock and serial numbers, and write immutable movement ledger', async () => {
      // 1. Balance update succeeds (sufficient available stock)
      vi.spyOn(StockBalanceModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      // 2. Serials update succeeds
      vi.spyOn(SerialNumberModel, 'updateMany').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 2,
        modifiedCount: 2,
        upsertedCount: 0,
        upsertedId: null,
      });

      // 3. Movement ledger created
      const movementCreateSpy = vi.spyOn(StockMovementModel, 'create').mockResolvedValueOnce([{} as any]);
      // 4. Outbox event recorded
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await StockReservationService.reserveStock({
        companyId: 'comp_cairo_hvac',
        orderId: 'so_order_1001',
        warehouseId: 'wh_nasr_city_01',
        items: [
          {
            productId: 'prod_carrier_2.25',
            quantity: 2,
            serialNumbers: ['SN_CARRIER_001', 'SN_CARRIER_002'],
          },
        ],
        performedBy: 'usr_sales_ahmed',
      });

      expect(result.reservationId).toBeDefined();
      expect(movementCreateSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'RESERVATION_HOLD',
            productId: 'prod_carrier_2.25',
            quantity: 2,
            direction: 'OUT',
          }),
        ]),
        expect.any(Object),
      );
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject reservation and abort when available quantity is insufficient (Rule 3 Invariant)', async () => {
      // MatchedCount = 0 indicates availableQuantity < requiredQuantity
      vi.spyOn(StockBalanceModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      });

      await expect(
        StockReservationService.reserveStock({
          companyId: 'comp_cairo_hvac',
          orderId: 'so_order_1002',
          warehouseId: 'wh_nasr_city_01',
          items: [{ productId: 'prod_carrier_2.25', quantity: 50 }],
          performedBy: 'usr_sales_ahmed',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should confirm final stock deduction (Step 5 of Cash Sale Saga) and transition Serials to SOLD', async () => {
      const balanceSpy = vi.spyOn(StockBalanceModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      const serialsSpy = vi.spyOn(SerialNumberModel, 'updateMany').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      const movementSpy = vi.spyOn(StockMovementModel, 'create').mockResolvedValueOnce([{} as any]);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await StockReservationService.confirmDeduction({
        companyId: 'comp_cairo_hvac',
        orderId: 'so_order_1001',
        warehouseId: 'wh_nasr_city_01',
        invoiceId: 'inv_cash_2026_01',
        items: [
          {
            productId: 'prod_carrier_2.25',
            quantity: 1,
            serialNumbers: ['SN_CARRIER_001'],
          },
        ],
        performedBy: 'usr_warehouse_ali',
      });

      expect(result.deductionId).toBeDefined();
      expect(serialsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp_cairo_hvac',
          serialNumber: { $in: ['SN_CARRIER_001'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            state: 'SOLD',
            soldInvoiceId: 'inv_cash_2026_01',
          }),
        }),
        expect.any(Object),
      );
      expect(movementSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'OUTBOUND_SALE',
          }),
        ]),
        expect.any(Object),
      );
    });

    it('should execute idempotent compensation (Rule 6) restoring stock and serials to IN_STOCK if Saga fails', async () => {
      const balanceSpy = vi.spyOn(StockBalanceModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      const serialsSpy = vi.spyOn(SerialNumberModel, 'updateMany').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      });

      const movementSpy = vi.spyOn(StockMovementModel, 'create').mockResolvedValueOnce([{} as any]);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      await StockReservationService.compensateSaleDeduction({
        companyId: 'comp_cairo_hvac',
        orderId: 'so_order_1001',
        warehouseId: 'wh_nasr_city_01',
        invoiceId: 'inv_cash_2026_01',
        items: [
          {
            productId: 'prod_carrier_2.25',
            quantity: 1,
            serialNumbers: ['SN_CARRIER_001'],
          },
        ],
        performedBy: 'saga_orchestrator',
      });

      // Verifies serial state is restored to IN_STOCK
      expect(serialsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: { $in: ['SN_CARRIER_001'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            state: 'IN_STOCK',
            soldInvoiceId: null,
          }),
        }),
        expect.any(Object),
      );

      // Verifies immutable compensation movement ledger entry is recorded
      expect(movementSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'COMPENSATION_RETURN',
            direction: 'IN',
          }),
        ]),
        expect.any(Object),
      );
    });
  });
});

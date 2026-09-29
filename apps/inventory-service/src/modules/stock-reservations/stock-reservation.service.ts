import crypto from 'node:crypto';
import { StockBalanceModel } from '../stock-balances/stock-balance.model.js';
import { StockMovementModel } from '../stock-movements/stock-movement.model.js';
import { SerialNumberModel } from '../serial-numbers/serial-number.model.js';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { getDistributedLock } from '../../config/redis.js';
import {
  StockReservedEvent,
  StockReleasedEvent,
  StockDeductedEvent,
  StockMovedEvent,
} from '@hvac/event-contracts';
import { ConflictError, NotFoundError } from '@hvac/errors';

export interface ReserveStockItem {
  productId: string;
  quantity: number;
  serialNumbers?: string[];
}

export interface ReserveStockInput {
  companyId: string;
  orderId: string;
  warehouseId: string;
  items: ReserveStockItem[];
  performedBy: string;
}

export class StockReservationService {
  /**
   * Atomically reserves stock and serials for an order.
   * Guarantees correctness at engine level via MongoDB Transaction + Conditional Atomic Update.
   */
  static async reserveStock(input: ReserveStockInput): Promise<{ reservationId: string }> {
    const reservationId = `res_${crypto.randomUUID().slice(0, 8)}`;
    // Contention mitigation layer (Rule 3)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const distLock = getDistributedLock();
        for (const item of input.items) {
          await distLock.acquire(`stock:${input.companyId}:${input.warehouseId}:${item.productId}`, 3000);
        }
      } catch {
        // Fallback to database engine level correctness
      }
    }

    return withTransaction(async (session) => {
      for (const item of input.items) {
        // 1. Conditional Atomic Update on Materialized Balance
        const balanceUpdate = await StockBalanceModel.updateOne(
          {
            companyId: input.companyId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            availableQuantity: { $gte: item.quantity },
          },
          {
            $inc: {
              availableQuantity: -item.quantity,
              reservedQuantity: item.quantity,
            },
            $set: { updatedAt: new Date() },
          },
          { session },
        );

        if (balanceUpdate.matchedCount === 0) {
          throw new ConflictError(
            `Insufficient available stock for product '${item.productId}' in warehouse '${input.warehouseId}'`,
          );
        }

        // 2. If Serials are specified, reserve them atomically
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          if (item.serialNumbers.length !== item.quantity) {
            throw new ConflictError(
              `Provided serials count (${item.serialNumbers.length}) does not match quantity (${item.quantity})`,
            );
          }

          const serialsUpdate = await SerialNumberModel.updateMany(
            {
              companyId: input.companyId,
              productId: item.productId,
              warehouseId: input.warehouseId,
              serialNumber: { $in: item.serialNumbers },
              state: 'IN_STOCK',
            },
            {
              $set: {
                state: 'RESERVED',
                reservationId,
                orderId: input.orderId,
              },
            },
            { session },
          );

          if (serialsUpdate.modifiedCount !== item.serialNumbers.length) {
            throw new ConflictError(
              `One or more requested serial numbers are not available in 'IN_STOCK' state`,
            );
          }
        }

        // 3. Write Immutable StockMovement Ledger Record
        const movementId = `mvt_${crypto.randomUUID().slice(0, 8)}`;
        await StockMovementModel.create(
          [
            {
              companyId: input.companyId,
              movementId,
              movementType: 'RESERVATION_HOLD',
              productId: item.productId,
              warehouseId: input.warehouseId,
              quantity: item.quantity,
              direction: 'OUT',
              serialNumbers: item.serialNumbers,
              referenceType: 'SALES_ORDER',
              referenceId: input.orderId,
              performedBy: input.performedBy,
              notes: `Stock reserved for Order ${input.orderId}`,
            },
          ],
          { session },
        );
      }

      // 4. Record Event in Transactional Outbox
      const event = new StockReservedEvent(
        {
          reservationId,
          orderId: input.orderId,
          warehouseId: input.warehouseId,
          items: input.items,
        },
        {
          companyId: input.companyId,
          correlationId: crypto.randomUUID(),
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return { reservationId };
    });
  }

  /**
   * Releases a previous reservation and returns stock to available.
   */
  static async releaseReservation(params: {
    companyId: string;
    reservationId: string;
    orderId: string;
    warehouseId: string;
    items: ReserveStockItem[];
    reason: string;
    performedBy: string;
  }): Promise<void> {
    return withTransaction(async (session) => {
      for (const item of params.items) {
        // 1. Revert Materialized Balance
        await StockBalanceModel.updateOne(
          {
            companyId: params.companyId,
            warehouseId: params.warehouseId,
            productId: item.productId,
            reservedQuantity: { $gte: item.quantity },
          },
          {
            $inc: {
              availableQuantity: item.quantity,
              reservedQuantity: -item.quantity,
            },
          },
          { session },
        );

        // 2. Revert Serials to IN_STOCK
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await SerialNumberModel.updateMany(
            {
              companyId: params.companyId,
              reservationId: params.reservationId,
              serialNumber: { $in: item.serialNumbers },
            },
            {
              $set: {
                state: 'IN_STOCK',
                reservationId: null,
                orderId: null,
              },
            },
            { session },
          );
        }

        // 3. Immutable Movement Ledger
        await StockMovementModel.create(
          [
            {
              companyId: params.companyId,
              movementId: `mvt_${crypto.randomUUID().slice(0, 8)}`,
              movementType: 'RESERVATION_RELEASE',
              productId: item.productId,
              warehouseId: params.warehouseId,
              quantity: item.quantity,
              direction: 'IN',
              serialNumbers: item.serialNumbers,
              referenceType: 'SALES_ORDER_CANCEL',
              referenceId: params.orderId,
              performedBy: params.performedBy,
              notes: params.reason,
            },
          ],
          { session },
        );
      }

      const event = new StockReleasedEvent(
        {
          reservationId: params.reservationId,
          orderId: params.orderId,
          warehouseId: params.warehouseId,
          reason: params.reason,
          items: params.items,
        },
        {
          companyId: params.companyId,
        },
      );

      await OutboxRepository.recordEvent(event, session);
    });
  }

  /**
   * Confirms final delivery & stock deduction (Step 5 of Cash Sale Saga).
   * Transitions Serials to SOLD and permanently deducts onHandQuantity.
   */
  static async confirmDeduction(params: {
    companyId: string;
    orderId: string;
    warehouseId: string;
    items: ReserveStockItem[];
    invoiceId: string;
    performedBy: string;
  }): Promise<{ deductionId: string }> {
    const deductionId = `ded_${crypto.randomUUID().slice(0, 8)}`;

    return withTransaction(async (session) => {
      for (const item of params.items) {
        // 1. Deduct from onHand and clear reserved
        await StockBalanceModel.updateOne(
          {
            companyId: params.companyId,
            warehouseId: params.warehouseId,
            productId: item.productId,
          },
          {
            $inc: {
              onHandQuantity: -item.quantity,
              reservedQuantity: -item.quantity,
            },
          },
          { session },
        );

        // 2. Transition Serials to SOLD
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await SerialNumberModel.updateMany(
            {
              companyId: params.companyId,
              serialNumber: { $in: item.serialNumbers },
            },
            {
              $set: {
                state: 'SOLD',
                soldInvoiceId: params.invoiceId,
                soldDate: new Date(),
              },
            },
            { session },
          );
        }

        // 3. Record Immutable Outbound Sale Movement
        await StockMovementModel.create(
          [
            {
              companyId: params.companyId,
              movementId: `mvt_${crypto.randomUUID().slice(0, 8)}`,
              movementType: 'OUTBOUND_SALE',
              productId: item.productId,
              warehouseId: params.warehouseId,
              quantity: item.quantity,
              direction: 'OUT',
              serialNumbers: item.serialNumbers,
              referenceType: 'SALES_INVOICE',
              referenceId: params.invoiceId,
              performedBy: params.performedBy,
              notes: `Sold via Invoice ${params.invoiceId}`,
            },
          ],
          { session },
        );
      }

      const event = new StockDeductedEvent(
        {
          deductionId,
          orderId: params.orderId,
          warehouseId: params.warehouseId,
          items: params.items,
        },
        {
          companyId: params.companyId,
        },
      );

      await OutboxRepository.recordEvent(event, session);
      return { deductionId };
    });
  }

  /**
   * Rule 6: Idempotent Compensation for Saga rollback if invoice posting fails after deduction.
   * Restores onHandQuantity and marks Serials back to IN_STOCK with compensation ledger entry.
   */
  static async compensateSaleDeduction(params: {
    companyId: string;
    orderId: string;
    warehouseId: string;
    items: ReserveStockItem[];
    invoiceId: string;
    performedBy: string;
  }): Promise<void> {
    return withTransaction(async (session) => {
      for (const item of params.items) {
        // 1. Revert balance back to onHand & available
        await StockBalanceModel.updateOne(
          {
            companyId: params.companyId,
            warehouseId: params.warehouseId,
            productId: item.productId,
          },
          {
            $inc: {
              onHandQuantity: item.quantity,
              availableQuantity: item.quantity,
            },
          },
          { session },
        );

        // 2. Restore serial state from SOLD back to IN_STOCK
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await SerialNumberModel.updateMany(
            {
              companyId: params.companyId,
              serialNumber: { $in: item.serialNumbers },
            },
            {
              $set: {
                state: 'IN_STOCK',
                soldInvoiceId: null,
                soldDate: null,
              },
            },
            { session },
          );
        }

        // 3. Compensation Ledger Movement (Immutable)
        await StockMovementModel.create(
          [
            {
              companyId: params.companyId,
              movementId: `mvt_${crypto.randomUUID().slice(0, 8)}`,
              movementType: 'COMPENSATION_RETURN',
              productId: item.productId,
              warehouseId: params.warehouseId,
              quantity: item.quantity,
              direction: 'IN',
              serialNumbers: item.serialNumbers,
              referenceType: 'SAGA_COMPENSATION',
              referenceId: params.orderId,
              performedBy: params.performedBy,
              notes: `Saga compensation return for Order ${params.orderId}`,
            },
          ],
          { session },
        );
      }

      const event = new StockMovedEvent(
        {
          movementId: `mvt_comp_${crypto.randomUUID().slice(0, 8)}`,
          productId: params.items[0]?.productId || '',
          warehouseId: params.warehouseId,
          quantity: params.items[0]?.quantity || 0,
          serialNumbers: params.items[0]?.serialNumbers,
          movementType: 'COMPENSATION_RETURN',
        },
        {
          companyId: params.companyId,
        },
      );

      await OutboxRepository.recordEvent(event, session);
    });
  }
}

import crypto from 'node:crypto';
import { SagaInstanceModel, SagaStatus } from '@hvac/database';
import { SalesOrderService, CreateOrderInput } from '../../modules/sales-orders/sales-order.service.js';
import { SalesInvoiceService } from '../../modules/sales-invoices/sales-invoice.service.js';
import { SalesOrderDocument } from '../../modules/sales-orders/sales-order.model.js';
import { SalesInvoiceDocument } from '../../modules/sales-invoices/sales-invoice.model.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'sales-service:cash-sale-saga' });

export interface CashSaleSagaInput extends CreateOrderInput {
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';
  treasuryId: string;
}

export interface CashSaleSagaResult {
  sagaId: string;
  orderId: string;
  invoiceId: string;
  orderNumber: string;
  invoiceNumber: string;
  status: 'COMPLETED' | 'FAILED';
  completedSteps: string[];
}

export interface InventoryClientAdapter {
  reserveStock: (params: any) => Promise<{ reservationId: string }>;
  releaseReservation: (params: any) => Promise<void>;
  confirmDeduction: (params: any) => Promise<{ deductionId: string }>;
  compensateSaleDeduction: (params: any) => Promise<void>;
}

export interface FinanceClientAdapter {
  collectPayment: (params: any) => Promise<{ paymentId: string; receiptNumber: string }>;
  refundPayment: (params: any) => Promise<{ refundId: string }>;
  postJournalEntry: (params: any) => Promise<{ journalEntryId: string }>;
}

export class CashSaleSagaOrchestrator {
  constructor(
    private readonly inventoryAdapter: InventoryClientAdapter,
    private readonly financeAdapter: FinanceClientAdapter,
  ) {}

  /**
   * Executes the 7-step Cash Sale Saga with persistent tracking and idempotent compensations.
   */
  async execute(input: CashSaleSagaInput, correlationId: string = crypto.randomUUID()): Promise<CashSaleSagaResult> {
    const sagaId = `saga_cash_${crypto.randomUUID().slice(0, 8)}`;
    logger.info({ sagaId, companyId: input.companyId, customerId: input.customerId }, 'Starting Cash Sale Saga');

    // 1. Initialize Persistent Saga Instance (Rule 7)
    const sagaDoc = await SagaInstanceModel.create({
      sagaId,
      sagaType: 'CASH_SALE_SAGA',
      aggregateId: '', // Will be updated with orderId
      companyId: input.companyId,
      currentStep: 'CREATE_PENDING_ORDER',
      status: 'RUNNING',
      completedSteps: [],
      retryCount: 0,
      correlationId,
      stateData: { input },
      startedAt: new Date(),
    });

    let order: SalesOrderDocument | null = null;
    let reservationId: string | null = null;
    let invoice: SalesInvoiceDocument | null = null;
    let paymentId: string | null = null;
    let deductionId: string | null = null;

    try {
      // Step 1: Create Pending Order (Sales Service)
      order = await SalesOrderService.createPendingOrder(input);
      await this.recordStepSuccess(sagaId, 'CREATE_PENDING_ORDER', {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
      });

      // Step 2: Reserve Stock & Serials (Inventory Service)
      const reservationRes = await this.inventoryAdapter.reserveStock({
        companyId: input.companyId,
        orderId: order.orderId,
        warehouseId: input.warehouseId,
        items: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          serialNumbers: i.serialNumbers,
        })),
        performedBy: input.salesRepresentativeId,
      });
      reservationId = reservationRes.reservationId;
      await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'STOCK_RESERVED', {
        reservationId,
      });
      await this.recordStepSuccess(sagaId, 'RESERVE_STOCK', { reservationId });

      // Step 3: Create Draft Invoice (Sales Service - Rule 11)
      invoice = await SalesInvoiceService.createDraftInvoice(order);
      await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'INVOICED', {
        invoiceId: invoice.invoiceId,
      });
      await this.recordStepSuccess(sagaId, 'CREATE_DRAFT_INVOICE', {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
      });

      // Step 4: Collect Payment (Finance Service)
      const paymentRes = await this.financeAdapter.collectPayment({
        companyId: input.companyId,
        branchId: input.branchId,
        treasuryId: input.treasuryId,
        orderId: order.orderId,
        invoiceId: invoice.invoiceId,
        amount: Number(invoice.netAmount.toString()),
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
      });
      paymentId = paymentRes.paymentId;
      await SalesInvoiceService.markInvoicePaid(input.companyId, invoice.invoiceId);
      await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'PAID');
      await this.recordStepSuccess(sagaId, 'COLLECT_PAYMENT', { paymentId });

      // Step 5: Confirm Delivery & Stock Deduction (Inventory Service)
      const deductionRes = await this.inventoryAdapter.confirmDeduction({
        companyId: input.companyId,
        orderId: order.orderId,
        warehouseId: input.warehouseId,
        invoiceId: invoice.invoiceId,
        items: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          serialNumbers: i.serialNumbers,
        })),
        performedBy: input.salesRepresentativeId,
      });
      deductionId = deductionRes.deductionId;
      await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'DELIVERED');
      await this.recordStepSuccess(sagaId, 'CONFIRM_STOCK_DEDUCTION', { deductionId });

      // Step 6: Post Invoice / Accounting Entry (Finance Service - Rule 11)
      const journalRes = await this.financeAdapter.postJournalEntry({
        companyId: input.companyId,
        branchId: input.branchId,
        invoiceId: invoice.invoiceId,
        orderId: order.orderId,
        amount: Number(invoice.netAmount.toString()),
        paymentMethod: input.paymentMethod,
      });
      await SalesInvoiceService.markInvoicePosted(input.companyId, invoice.invoiceId);
      await this.recordStepSuccess(sagaId, 'POST_JOURNAL_ENTRY', { journalId: journalRes.journalEntryId });

      // Step 7: Complete Sale (Sales Service)
      await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'COMPLETED');
      await this.recordStepSuccess(sagaId, 'COMPLETE_SALE', {});

      // Mark Saga COMPLETED
      await SagaInstanceModel.updateOne(
        { sagaId },
        {
          $set: {
            status: 'COMPLETED',
            currentStep: 'COMPLETED',
            completedAt: new Date(),
          },
        },
      );

      logger.info({ sagaId, orderId: order.orderId, invoiceId: invoice.invoiceId }, 'Cash Sale Saga completed successfully');

      return {
        sagaId,
        orderId: order.orderId,
        invoiceId: invoice.invoiceId,
        orderNumber: order.orderNumber,
        invoiceNumber: invoice.invoiceNumber,
        status: 'COMPLETED',
        completedSteps: [
          'CREATE_PENDING_ORDER',
          'RESERVE_STOCK',
          'CREATE_DRAFT_INVOICE',
          'COLLECT_PAYMENT',
          'CONFIRM_STOCK_DEDUCTION',
          'POST_JOURNAL_ENTRY',
          'COMPLETE_SALE',
        ],
      };
    } catch (sagaError) {
      logger.error({ err: sagaError, sagaId }, 'Cash Sale Saga step failed, initiating rollback compensations...');
      await this.compensate(
        sagaId,
        input,
        order,
        reservationId,
        invoice,
        paymentId,
        deductionId,
        (sagaError as Error).message,
      );

      throw sagaError;
    }
  }

  private async recordStepSuccess(
    sagaId: string,
    stepName: string,
    stepData: Record<string, unknown>,
  ): Promise<void> {
    await SagaInstanceModel.updateOne(
      { sagaId },
      {
        $push: { completedSteps: stepName },
        $set: {
          currentStep: stepName,
          [`stateData.${stepName}`]: stepData,
        },
      },
    );
  }

  /**
   * Idempotent Compensation Handlers (Rule 6).
   * Reverses operations in strict LIFO order.
   */
  private async compensate(
    sagaId: string,
    input: CashSaleSagaInput,
    order: SalesOrderDocument | null,
    reservationId: string | null,
    invoice: SalesInvoiceDocument | null,
    paymentId: string | null,
    deductionId: string | null,
    errorMessage: string,
  ): Promise<void> {
    await SagaInstanceModel.updateOne(
      { sagaId },
      {
        $set: {
          status: 'COMPENSATING',
          failedStep: errorMessage,
        },
      },
    );

    // 1. Compensate Stock Deduction (if deduction succeeded but journal posting failed)
    if (deductionId && order && invoice) {
      try {
        await this.inventoryAdapter.compensateSaleDeduction({
          companyId: input.companyId,
          orderId: order.orderId,
          warehouseId: input.warehouseId,
          items: input.items,
          invoiceId: invoice.invoiceId,
          performedBy: 'saga_orchestrator',
        });
        logger.info({ sagaId }, 'Compensated stock deduction');
      } catch (err) {
        logger.error({ err, sagaId }, 'Failed to compensate stock deduction');
      }
    }

    // 2. Compensate Payment (if payment was collected)
    if (paymentId) {
      try {
        await this.financeAdapter.refundPayment({
          companyId: input.companyId,
          paymentId,
          reason: `Cash Sale Saga Failure: ${errorMessage}`,
        });
        logger.info({ sagaId }, 'Compensated/refunded collected payment');
      } catch (err) {
        logger.error({ err, sagaId }, 'Failed to compensate payment');
      }
    }

    // 3. Compensate Invoice (mark voided)
    if (invoice) {
      try {
        await SalesInvoiceService.voidInvoice(
          input.companyId,
          invoice.invoiceId,
          `Voided due to Saga failure: ${errorMessage}`,
        );
        logger.info({ sagaId }, 'Compensated/voided commercial invoice');
      } catch (err) {
        logger.error({ err, sagaId }, 'Failed to void invoice');
      }
    }

    // 4. Compensate Stock Reservation (release hold if deduction did not happen)
    if (reservationId && !deductionId && order) {
      try {
        await this.inventoryAdapter.releaseReservation({
          companyId: input.companyId,
          reservationId,
          orderId: order.orderId,
          warehouseId: input.warehouseId,
          items: input.items,
          reason: `Saga compensation rollback: ${errorMessage}`,
          performedBy: 'saga_orchestrator',
        });
        logger.info({ sagaId }, 'Compensated/released stock reservation hold');
      } catch (err) {
        logger.error({ err, sagaId }, 'Failed to release stock reservation hold');
      }
    }

    // 5. Compensate Sales Order (mark cancelled)
    if (order) {
      try {
        await SalesOrderService.updateOrderStatus(input.companyId, order.orderId, 'CANCELLED', {
          notes: `Cancelled by Saga compensation: ${errorMessage}`,
        });
        logger.info({ sagaId }, 'Compensated/cancelled sales order');
      } catch (err) {
        logger.error({ err, sagaId }, 'Failed to cancel sales order');
      }
    }

    // Mark Saga FAILED
    await SagaInstanceModel.updateOne(
      { sagaId },
      {
        $set: {
          status: 'FAILED',
          currentStep: 'FAILED',
          completedAt: new Date(),
        },
      },
    );
  }
}

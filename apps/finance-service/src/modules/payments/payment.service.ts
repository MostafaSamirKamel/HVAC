import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { PaymentReceivedEvent, RefundCompletedEvent } from '@hvac/event-contracts';
import { PaymentModel, IPayment, PaymentMethod } from './payment.model.js';
import { TreasuryService } from '../treasuries/treasury.service.js';
import { TreasuryModel } from '../treasuries/treasury.model.js';
import { AccountService } from '../chart-of-accounts/account.service.js';
import { JournalEntryService } from '../journal-entries/journal-entry.service.js';

export interface CollectPaymentInput {
  companyId: string;
  branchId: string;
  treasuryId?: string;
  invoiceId?: string;
  orderId?: string;
  customerId?: string;
  amount: number | string;
  paymentMethod?: PaymentMethod;
  currency?: string;
  collectedBy: string;
}

export interface PostInvoiceJournalInput {
  companyId: string;
  branchId: string;
  invoiceId: string;
  orderId?: string;
  amount: number | string;
  paymentMethod?: PaymentMethod;
  performedBy?: string;
  currency?: string;
}

export interface RollbackPaymentInput {
  companyId: string;
  paymentId?: string;
  orderId?: string;
  invoiceId?: string;
  reason?: string;
  performedBy?: string;
}

export class PaymentService {
  /**
   * Collects payment for an invoice/order atomically (Step 4 of Cash Sale Saga)
   */
  public static async collectPayment(
    input: CollectPaymentInput,
    existingSession?: ClientSession
  ): Promise<IPayment> {
    const currency = input.currency || 'EGP';
    const amountMoney = Money.from(input.amount, currency);

    if (!amountMoney.isPositive()) {
      throw new ValidationError('Payment amount must be positive');
    }

    const runner = async (session: ClientSession) => {
      // Find or default treasury for branch
      let treasuryId = input.treasuryId;
      if (!treasuryId) {
        const defaultTreasury = await TreasuryModel.findOne({
          companyId: input.companyId,
          branchId: input.branchId,
          isActive: true,
        }).session(session);

        if (!defaultTreasury) {
          throw new NotFoundError(
            `No active treasury safe found for branch ${input.branchId} in company ${input.companyId}`
          );
        }
        treasuryId = defaultTreasury.treasuryId;
      }

      // Check idempotency: if payment already collected for this invoice
      if (input.invoiceId) {
        const existingPayment = await PaymentModel.findOne({
          companyId: input.companyId,
          invoiceId: input.invoiceId,
          status: 'COLLECTED',
        }).session(session);

        if (existingPayment) {
          return existingPayment;
        }
      }

      // Record Treasury Movement (INFLOW) atomically
      const { movement } = await TreasuryService.recordMovement(
        {
          companyId: input.companyId,
          treasuryId,
          movementType: 'INFLOW',
          amount: amountMoney.toString(),
          referenceType: 'CASH_SALE',
          referenceId: input.invoiceId || input.orderId || randomUUID(),
          description: `Payment collection for order ${input.orderId || ''} / invoice ${input.invoiceId || ''}`,
          performedBy: input.collectedBy,
        },
        session
      );

      const paymentId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const paymentNumber = `PAY-${new Date().getFullYear()}-${randomSuffix}`;

      const [payment] = await PaymentModel.create(
        [
          {
            companyId: input.companyId,
            paymentId,
            paymentNumber,
            customerId: input.customerId,
            orderId: input.orderId,
            invoiceId: input.invoiceId,
            treasuryId,
            branchId: input.branchId,
            amount: mongoose.Types.Decimal128.fromString(amountMoney.toString()),
            currency,
            paymentMethod: input.paymentMethod || 'CASH',
            status: 'COLLECTED',
            treasuryMovementId: movement.movementId,
            collectedBy: input.collectedBy,
            collectedAt: new Date(),
          },
        ],
        { session }
      );

      // Publish Outbox Event inside transaction
      const event = new PaymentReceivedEvent(
        {
          paymentId,
          treasuryId,
          customerId: input.customerId,
          orderId: input.orderId,
          amount: amountMoney.toNumber(),
          currency,
          paymentMethod: input.paymentMethod || 'CASH',
          branchId: input.branchId,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.collectedBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return payment;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Posts accounting general ledger entry for an invoice (Step 6 of Cash Sale Saga - Rule 11)
   */
  public static async postInvoiceAccountingEntry(
    input: PostInvoiceJournalInput,
    existingSession?: ClientSession
  ): Promise<{ journalEntryId: string; entryNumber: string }> {
    const currency = input.currency || 'EGP';
    const amountMoney = Money.from(input.amount, currency);

    const runner = async (session: ClientSession) => {
      // Ensure standard accounts exist
      await AccountService.ensureStandardAccounts(input.companyId, session);

      const cashAccount = await AccountService.getAccountByCode(input.companyId, '101001', session);
      const salesRevenueAccount = await AccountService.getAccountByCode(input.companyId, '401001', session);

      // Debit Cash on Hand, Credit Sales Revenue
      const entry = await JournalEntryService.createAndPostEntry(
        {
          companyId: input.companyId,
          sourceModule: 'SALES',
          sourceReferenceId: input.invoiceId,
          description: `Commercial invoice revenue posting for Invoice ${input.invoiceId} (Order ${input.orderId || ''})`,
          lines: [
            {
              accountId: cashAccount.accountId,
              accountCode: cashAccount.accountCode,
              accountName: cashAccount.accountName,
              debit: amountMoney.toString(),
              credit: '0.00',
              branchId: input.branchId,
              description: 'Cash safe receipt',
            },
            {
              accountId: salesRevenueAccount.accountId,
              accountCode: salesRevenueAccount.accountCode,
              accountName: salesRevenueAccount.accountName,
              debit: '0.00',
              credit: amountMoney.toString(),
              branchId: input.branchId,
              description: 'Commercial sales revenue',
            },
          ],
          postedBy: input.performedBy || 'system',
          currency,
        },
        session
      );

      return { journalEntryId: entry.journalEntryId, entryNumber: entry.entryNumber };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Idempotent saga compensation for payment collection failure (Rule 6)
   */
  public static async rollbackPayment(
    input: RollbackPaymentInput,
    existingSession?: ClientSession
  ): Promise<{ refunded: boolean; paymentId?: string }> {
    const runner = async (session: ClientSession) => {
      const query: Record<string, unknown> = { companyId: input.companyId };
      if (input.paymentId) {
        query.paymentId = input.paymentId;
      } else if (input.invoiceId) {
        query.invoiceId = input.invoiceId;
      } else if (input.orderId) {
        query.orderId = input.orderId;
      } else {
        return { refunded: false };
      }

      const payment = await PaymentModel.findOne(query).session(session);
      if (!payment) {
        return { refunded: false };
      }

      // Idempotency: if already refunded or voided
      if (payment.status !== 'COLLECTED') {
        return { refunded: true, paymentId: payment.paymentId };
      }

      // Record compensating OUTFLOW in Treasury
      const { movement } = await TreasuryService.recordMovement(
        {
          companyId: input.companyId,
          treasuryId: payment.treasuryId,
          movementType: 'OUTFLOW',
          amount: payment.amount.toString(),
          referenceType: 'ADJUSTMENT',
          referenceId: payment.paymentId,
          description: `Compensating refund rollback for ${input.reason || 'Saga compensation'}`,
          performedBy: input.performedBy || 'system',
        },
        session
      );

      payment.status = 'REFUNDED';
      payment.refundMovementId = movement.movementId;
      payment.refundedAt = new Date();
      await payment.save({ session });

      // Outbox Event
      const refundEvent = new RefundCompletedEvent(
        {
          refundId: randomUUID(),
          orderId: payment.orderId || '',
          customerId: payment.customerId || '',
          amount: Number(payment.amount.toString()),
          currency: payment.currency,
          branchId: payment.branchId,
        },
        {
          companyId: input.companyId,
          branchId: payment.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.performedBy || 'system' },
        }
      );

      await OutboxRepository.recordEvent(refundEvent, session);

      return { refunded: true, paymentId: payment.paymentId };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Idempotent saga compensation for posted journal entry (Rule 6)
   */
  public static async rollbackJournalEntry(
    input: { companyId: string; journalId?: string; invoiceId?: string; reason?: string; performedBy?: string },
    existingSession?: ClientSession
  ): Promise<{ reversed: boolean; journalId?: string }> {
    const runner = async (session: ClientSession) => {
      let journalId = input.journalId;
      if (!journalId && input.invoiceId) {
        const found = await JournalEntryService.getEntryById(input.companyId, input.invoiceId).catch(() => null);
        if (found) journalId = found.journalEntryId;
      }

      if (!journalId) {
        return { reversed: false };
      }

      try {
        const reversal = await JournalEntryService.reverseJournalEntry(
          input.companyId,
          journalId,
          input.reason || 'Saga compensation rollback',
          input.performedBy || 'system',
          session
        );
        return { reversed: true, journalId: reversal.journalEntryId };
      } catch (err) {
        // If already voided or not found, compensate idempotently
        return { reversed: false };
      }
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }
}

import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface PaymentReceivedPayload {
  paymentId: string;
  treasuryId?: string;
  bankAccountId?: string;
  customerId?: string;
  orderId?: string;
  installmentContractId?: string;
  amount: number;
  currency: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  branchId: string;
}

export class PaymentReceivedEvent extends BaseDomainEvent<PaymentReceivedPayload> {
  constructor(payload: PaymentReceivedPayload, context: BaseEventContext) {
    super('finance.payment.received', 1, 'Payment', payload.paymentId, payload, { ...context, branchId: payload.branchId });
  }
}

export interface ExpenseCreatedPayload {
  expenseId: string;
  treasuryId: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  branchId: string;
}

export class ExpenseCreatedEvent extends BaseDomainEvent<ExpenseCreatedPayload> {
  constructor(payload: ExpenseCreatedPayload, context: BaseEventContext) {
    super('finance.expense.created', 1, 'Expense', payload.expenseId, payload, { ...context, branchId: payload.branchId });
  }
}

export interface RefundCompletedPayload {
  refundId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  branchId: string;
}

export class RefundCompletedEvent extends BaseDomainEvent<RefundCompletedPayload> {
  constructor(payload: RefundCompletedPayload, context: BaseEventContext) {
    super('finance.refund.completed', 1, 'Refund', payload.refundId, payload, { ...context, branchId: payload.branchId });
  }
}

export interface JournalEntryPostedPayload {
  journalEntryId: string;
  entryNumber: string;
  sourceModule: string;
  sourceReferenceId?: string;
  totalDebit: number;
  totalCredit: number;
  currency: string;
  branchId?: string;
}

export class JournalEntryPostedEvent extends BaseDomainEvent<JournalEntryPostedPayload> {
  constructor(payload: JournalEntryPostedPayload, context: BaseEventContext) {
    super('finance.journal.posted', 1, 'JournalEntry', payload.journalEntryId, payload, { ...context, branchId: payload.branchId });
  }
}

export interface TreasuryMovementRecordedPayload {
  movementId: string;
  treasuryId: string;
  movementType: 'INFLOW' | 'OUTFLOW';
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  branchId: string;
}

export class TreasuryMovementRecordedEvent extends BaseDomainEvent<TreasuryMovementRecordedPayload> {
  constructor(payload: TreasuryMovementRecordedPayload, context: BaseEventContext) {
    super('finance.treasury.movement_recorded', 1, 'TreasuryLedger', payload.movementId, payload, { ...context, branchId: payload.branchId });
  }
}


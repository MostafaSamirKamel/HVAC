import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface InstallmentContractCreatedPayload {
  contractId: string;
  contractNumber: string;
  customerId: string;
  orderId?: string;
  totalFinancedAmount: number;
  downPayment: number;
  totalInterest: number;
  totalPayable: number;
  tenorMonths: number;
  branchId: string;
}

export class InstallmentContractCreatedEvent extends BaseDomainEvent<InstallmentContractCreatedPayload> {
  constructor(payload: InstallmentContractCreatedPayload, context: BaseEventContext) {
    super('installment.contract.created', 1, 'InstallmentContract', payload.contractId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface InstallmentPaidPayload {
  contractId: string;
  installmentNumber: number;
  amountPaid: number;
  remainingContractBalance: number;
  branchId: string;
}

export class InstallmentPaidEvent extends BaseDomainEvent<InstallmentPaidPayload> {
  constructor(payload: InstallmentPaidPayload, context: BaseEventContext) {
    super('installment.payment.received', 1, 'InstallmentPayment', payload.contractId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface InstallmentOverduePayload {
  contractId: string;
  installmentNumber: number;
  daysOverdue: number;
  overdueAmount: number;
  lateFee: number;
  branchId: string;
}

export class InstallmentOverdueEvent extends BaseDomainEvent<InstallmentOverduePayload> {
  constructor(payload: InstallmentOverduePayload, context: BaseEventContext) {
    super('installment.overdue.detected', 1, 'InstallmentContract', payload.contractId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface InstallmentSettledEarlyPayload {
  contractId: string;
  contractNumber: string;
  customerId: string;
  settlementAmount: number;
  waivedInterestAmount: number;
  branchId: string;
  settledAt: string;
}

export class InstallmentSettledEarlyEvent extends BaseDomainEvent<InstallmentSettledEarlyPayload> {
  constructor(payload: InstallmentSettledEarlyPayload, context: BaseEventContext) {
    super('installment.contract.settled_early', 1, 'InstallmentContract', payload.contractId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface InstallmentRescheduledPayload {
  contractId: string;
  contractNumber: string;
  customerId: string;
  newTenorMonths: number;
  newMonthlyInstallment: number;
  rescheduledPrincipal: number;
  branchId: string;
}

export class InstallmentRescheduledEvent extends BaseDomainEvent<InstallmentRescheduledPayload> {
  constructor(payload: InstallmentRescheduledPayload, context: BaseEventContext) {
    super('installment.contract.rescheduled', 1, 'InstallmentContract', payload.contractId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

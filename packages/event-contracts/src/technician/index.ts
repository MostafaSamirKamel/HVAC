import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface TechnicianSettlementSubmittedPayload {
  settlementId: string;
  technicianId: string;
  branchId: string;
  totalCashCollected: number;
  treasuryId?: string;
  settledAt: string;
  usedSpareParts: { productId: string; quantity: number }[];
  returnedSpareParts: { productId: string; quantity: number }[];
}

export class TechnicianSettlementSubmittedEvent extends BaseDomainEvent<TechnicianSettlementSubmittedPayload> {
  constructor(payload: TechnicianSettlementSubmittedPayload, context: BaseEventContext) {
    super('technician.settlement.submitted', 1, 'TechnicianSettlement', payload.settlementId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface TechnicianCommissionEarnedPayload {
  technicianId: string;
  workOrderId: string;
  commissionAmount: number;
  reason: string;
  branchId: string;
}

export class TechnicianCommissionEarnedEvent extends BaseDomainEvent<TechnicianCommissionEarnedPayload> {
  constructor(payload: TechnicianCommissionEarnedPayload, context: BaseEventContext) {
    super('technician.commission.earned', 1, 'Technician', payload.technicianId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

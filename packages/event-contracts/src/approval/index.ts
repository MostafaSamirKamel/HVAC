import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface ApprovalRequestCreatedPayload {
  requestId: string;
  referenceType: string;
  referenceId: string;
  requestType: string;
  requestedBy: string;
  branchId: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export class ApprovalRequestCreatedEvent extends BaseDomainEvent<ApprovalRequestCreatedPayload> {
  constructor(payload: ApprovalRequestCreatedPayload, context: BaseEventContext) {
    super('approval.request.created', 1, 'ApprovalRequest', payload.requestId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface ApprovalRequestApprovedPayload {
  requestId: string;
  referenceType: string;
  referenceId: string;
  requestType: string;
  approverId: string;
  branchId: string;
  approvedAt: string;
  metadata?: Record<string, unknown>;
}

export class ApprovalRequestApprovedEvent extends BaseDomainEvent<ApprovalRequestApprovedPayload> {
  constructor(payload: ApprovalRequestApprovedPayload, context: BaseEventContext) {
    super('approval.request.approved', 1, 'ApprovalRequest', payload.requestId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface ApprovalRequestRejectedPayload {
  requestId: string;
  referenceType: string;
  referenceId: string;
  requestType: string;
  approverId: string;
  branchId: string;
  rejectionReason: string;
  rejectedAt: string;
}

export class ApprovalRequestRejectedEvent extends BaseDomainEvent<ApprovalRequestRejectedPayload> {
  constructor(payload: ApprovalRequestRejectedPayload, context: BaseEventContext) {
    super('approval.request.rejected', 1, 'ApprovalRequest', payload.requestId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface CustomerCreatedPayload {
  customerId: string;
  customerNumber: string;
  name: string;
  type: 'INDIVIDUAL' | 'COMMERCIAL';
  phone: string;
  creditLimit: number;
  branchId: string;
}

export class CustomerCreatedEvent extends BaseDomainEvent<CustomerCreatedPayload> {
  constructor(payload: CustomerCreatedPayload, context: BaseEventContext) {
    super('customer.created', 1, 'Customer', payload.customerId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface CustomerCreditLimitUpdatedPayload {
  customerId: string;
  oldLimit: number;
  newLimit: number;
  reason?: string;
  branchId: string;
}

export class CustomerCreditLimitUpdatedEvent extends BaseDomainEvent<CustomerCreditLimitUpdatedPayload> {
  constructor(payload: CustomerCreditLimitUpdatedPayload, context: BaseEventContext) {
    super('customer.credit_limit.updated', 1, 'Customer', payload.customerId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface CustomerEquipmentRegisteredPayload {
  equipmentId: string;
  customerId: string;
  serialNumber: string;
  brand: string;
  capacityHP?: number;
  equipmentType: string;
  installationDate: string;
  warrantyEndDate: string;
  branchId: string;
}

export class CustomerEquipmentRegisteredEvent extends BaseDomainEvent<CustomerEquipmentRegisteredPayload> {
  constructor(payload: CustomerEquipmentRegisteredPayload, context: BaseEventContext) {
    super('customer.equipment.registered', 1, 'CustomerEquipment', payload.equipmentId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface CustomerCreditBlockedPayload {
  customerId: string;
  creditStatus: string;
  reason: string;
  blockedBy: string;
  branchId: string;
}

export class CustomerCreditBlockedEvent extends BaseDomainEvent<CustomerCreditBlockedPayload> {
  constructor(payload: CustomerCreditBlockedPayload, context: BaseEventContext) {
    super('customer.credit.blocked', 1, 'Customer', payload.customerId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

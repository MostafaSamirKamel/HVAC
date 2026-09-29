import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface WorkOrderScheduledPayload {
  workOrderId: string;
  orderNumber: string;
  ticketId?: string;
  customerId: string;
  addressId: string;
  technicianId?: string;
  teamLeaderId?: string;
  serviceType: 'INSTALLATION' | 'MAINTENANCE' | 'REPAIR' | 'WARRANTY_INSPECTION';
  scheduledDate: string;
  branchId: string;
}

export class WorkOrderScheduledEvent extends BaseDomainEvent<WorkOrderScheduledPayload> {
  constructor(payload: WorkOrderScheduledPayload, context: BaseEventContext) {
    super('service.work_order.scheduled', 1, 'WorkOrder', payload.workOrderId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface WorkOrderCompletedPayload {
  workOrderId: string;
  orderNumber: string;
  customerId: string;
  technicianId: string;
  completedAt: string;
  installedSerialNumbers?: string[];
  sparePartsUsed?: { productId: string; quantity: number }[];
  branchId: string;
}

export class WorkOrderCompletedEvent extends BaseDomainEvent<WorkOrderCompletedPayload> {
  constructor(payload: WorkOrderCompletedPayload, context: BaseEventContext) {
    super('service.work_order.completed', 1, 'WorkOrder', payload.workOrderId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface WarrantyRegisteredPayload {
  warrantyId: string;
  serialNumber: string;
  productId: string;
  customerId: string;
  startDate: string;
  machineExpiryDate: string;
  compressorExpiryDate: string;
  branchId: string;
}

export class WarrantyRegisteredEvent extends BaseDomainEvent<WarrantyRegisteredPayload> {
  constructor(payload: WarrantyRegisteredPayload, context: BaseEventContext) {
    super('service.warranty.registered', 1, 'Warranty', payload.warrantyId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface ServiceTicketCreatedPayload {
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  category: string;
  priority: string;
  title: string;
  branchId: string;
}

export class ServiceTicketCreatedEvent extends BaseDomainEvent<ServiceTicketCreatedPayload> {
  constructor(payload: ServiceTicketCreatedPayload, context: BaseEventContext) {
    super('service.ticket.created', 1, 'ServiceTicket', payload.ticketId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface ServiceTicketResolvedPayload {
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  resolvedAt: string;
  branchId: string;
}

export class ServiceTicketResolvedEvent extends BaseDomainEvent<ServiceTicketResolvedPayload> {
  constructor(payload: ServiceTicketResolvedPayload, context: BaseEventContext) {
    super('service.ticket.resolved', 1, 'ServiceTicket', payload.ticketId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

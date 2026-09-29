export interface EventActor {
  userId: string;
  roles?: string[];
  email?: string;
}

export interface EventMetadata {
  eventId: string;
  eventType: string; // e.g., 'inventory.stock.reserved'
  eventVersion: number; // e.g., 1
  routingKey: string; // e.g., 'inventory.stock.reserved.v1'
  aggregateType: string;
  aggregateId: string;
  timestamp: string; // ISO 8601
  correlationId: string;
  causationId?: string;
  companyId: string;
  branchId?: string;
  actor?: EventActor;
}

export interface DomainEvent<TPayload = unknown> {
  metadata: EventMetadata;
  payload: TPayload;
}

export interface BaseEventContext {
  companyId: string;
  branchId?: string;
  correlationId?: string;
  causationId?: string;
  eventId?: string;
  actor?: EventActor;
}

export abstract class BaseDomainEvent<TPayload> implements DomainEvent<TPayload> {
  public readonly metadata: EventMetadata;
  public readonly payload: TPayload;

  constructor(
    eventType: string,
    eventVersion: number,
    aggregateType: string,
    aggregateId: string,
    payload: TPayload,
    context: BaseEventContext,
  ) {
    const correlationId = context.correlationId || crypto.randomUUID();
    const eventId = context.eventId || crypto.randomUUID();
    const routingKey = `${eventType}.v${eventVersion}`;

    this.metadata = {
      eventId,
      eventType,
      eventVersion,
      routingKey,
      aggregateType,
      aggregateId,
      timestamp: new Date().toISOString(),
      correlationId,
      causationId: context.causationId,
      companyId: context.companyId,
      branchId: context.branchId,
      actor: context.actor,
    };
    this.payload = payload;
  }
}

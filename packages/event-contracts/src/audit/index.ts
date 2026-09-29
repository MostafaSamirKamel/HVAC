import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXECUTE';

export interface AuditEntityChangedPayload {
  entityType: string;
  entityId: string;
  action: AuditActionType;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  diff?: Record<string, { before: unknown; after: unknown }>;
  reason?: string;
}

export class AuditEntityChangedEvent extends BaseDomainEvent<AuditEntityChangedPayload> {
  constructor(payload: AuditEntityChangedPayload, context: BaseEventContext) {
    super('audit.entity.changed', 1, payload.entityType, payload.entityId, payload, context);
  }
}

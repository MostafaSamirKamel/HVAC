import { ConfirmChannel } from 'amqplib';
import { DomainEvent } from '@hvac/event-contracts';
import { HVAC_EVENTS_EXCHANGE } from './topology.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'messaging:publisher' });

export class EventPublisher {
  constructor(private readonly channel: ConfirmChannel) {}

  /**
   * Publishes a domain event with Publisher Confirmation.
   * Resolves only when RabbitMQ acknowledges persistence to disk/memory.
   */
  async publish(event: DomainEvent<unknown>): Promise<void> {
    const routingKey = event.metadata.routingKey;
    const content = Buffer.from(JSON.stringify(event));

    return new Promise<void>((resolve, reject) => {
      this.channel.publish(
        HVAC_EVENTS_EXCHANGE,
        routingKey,
        content,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          timestamp: new Date(event.metadata.timestamp).getTime(),
          headers: {
            eventType: event.metadata.eventType,
            eventVersion: event.metadata.eventVersion,
            companyId: event.metadata.companyId,
            branchId: event.metadata.branchId,
          },
        },
        (err: unknown) => {
          if (err) {
            logger.error({ err, eventId: event.metadata.eventId, routingKey }, 'Failed to publish event');
            return reject(err as Error);
          }
          logger.debug({ eventId: event.metadata.eventId, routingKey }, 'Event published and confirmed');
          resolve();
        },
      );
    });
  }
}

import { Channel, ConsumeMessage } from 'amqplib';
import { DomainEvent } from '@hvac/event-contracts';
import { InboxRepository, InboxRetentionCategory } from '@hvac/database';
import { HVAC_EVENTS_EXCHANGE, HVAC_DLX_EXCHANGE } from './topology.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'messaging:consumer' });

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

export interface ConsumerOptions {
  queueName: string;
  consumerGroup: string;
  routingKeys: string[];
  prefetchCount?: number;
  retentionCategory?: InboxRetentionCategory;
}

export class IdempotentConsumer {
  private consumerTag: string | null = null;

  constructor(
    private readonly channel: Channel,
    private readonly options: ConsumerOptions,
  ) {}

  async start(handler: EventHandler): Promise<void> {
    const { queueName, consumerGroup, routingKeys, prefetchCount = 10, retentionCategory } = this.options;

    await this.channel.prefetch(prefetchCount);

    // Assert queue with Dead Letter Exchange configuration
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': HVAC_DLX_EXCHANGE,
      },
    });

    // Bind all specified routing keys (supporting '#' wildcards)
    for (const key of routingKeys) {
      await this.channel.bindQueue(queueName, HVAC_EVENTS_EXCHANGE, key);
      logger.info({ queueName, key }, 'Bound queue to topic key');
    }

    const { consumerTag } = await this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        let event: DomainEvent;
        try {
          event = JSON.parse(msg.content.toString('utf-8')) as DomainEvent;
        } catch (parseErr) {
          logger.error({ err: parseErr }, 'Malformed event JSON, rejecting to DLQ');
          return this.channel.nack(msg, false, false); // Route directly to dead letter
        }

        const eventId = event.metadata?.eventId || msg.properties.messageId;
        const companyId = event.metadata?.companyId || '';
        const eventType = event.metadata?.eventType || '';

        try {
          // Idempotency check: has this event already been processed by this consumer group?
          const alreadyProcessed = await InboxRepository.isProcessed(eventId, consumerGroup);
          if (alreadyProcessed) {
            logger.info(
              { eventId, consumerGroup, eventType },
              'Idempotent duplicate event detected — acknowledging and skipping',
            );
            return this.channel.ack(msg);
          }

          // Execute business logic handler
          await handler(event);

          // Mark as processed in Inbox
          await InboxRepository.markProcessed({
            eventId,
            eventType,
            consumerGroup,
            companyId,
            retentionCategory: retentionCategory || 'STANDARD',
          });

          this.channel.ack(msg);
        } catch (handlerErr) {
          logger.error(
            { err: handlerErr, eventId, eventType, queueName },
            'Consumer handler failed, rejecting to DLX',
          );
          // Send to DLQ without requeue to avoid poison pill loops
          this.channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );

    this.consumerTag = consumerTag;
    logger.info({ queueName, consumerGroup }, 'Consumer started successfully');
  }

  async stop(): Promise<void> {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => {});
      this.consumerTag = null;
      logger.info({ queue: this.options.queueName }, 'Consumer cancelled gracefully');
    }
  }
}

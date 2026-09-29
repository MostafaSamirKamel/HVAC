import {
  RabbitMQConnection,
  setupTopology,
  EventPublisher,
  OutboxDispatcher,
  IdempotentConsumer,
} from '@hvac/messaging';
import { env } from './env.js';
import { createLogger } from '@hvac/logger';
import { AuditLogService } from '../modules/audit-logs/audit-log.service.js';

const logger = createLogger({ serviceName: 'audit-service:messaging' });

let rabbitConn: RabbitMQConnection | null = null;
let publisher: EventPublisher | null = null;
let outboxDispatcher: OutboxDispatcher | null = null;
let consumer: IdempotentConsumer | null = null;

export async function initMessaging(): Promise<{
  publisher: EventPublisher;
  outboxDispatcher: OutboxDispatcher;
}> {
  rabbitConn = new RabbitMQConnection(env.RABBITMQ_URL);
  const confirmChannel = await rabbitConn.getConfirmChannel();
  const consumerChannel = await rabbitConn.createChannel();

  await setupTopology(confirmChannel);

  publisher = new EventPublisher(confirmChannel);
  outboxDispatcher = new OutboxDispatcher(publisher, 1500, 50);
  outboxDispatcher.start();

  consumer = new IdempotentConsumer(consumerChannel, {
    queueName: 'q.audit_service',
    consumerGroup: 'audit-service',
    routingKeys: [
      'audit.#',
      '*.changed.#',
      '*.created.#',
      '*.cancelled.#',
      '*.reversed.#',
    ],
    retentionCategory: 'PERMANENT',
  });

  await consumer.start(async (event) => {
    try {
      await AuditLogService.processDomainEvent(event as any);
      logger.info(
        { eventType: event.metadata?.eventType, aggregateId: event.metadata?.aggregateId },
        'Audit Service recorded domain event'
      );
    } catch (err) {
      logger.error({ err, eventId: event.metadata?.eventId }, 'Failed to record audit log from domain event');
      throw err;
    }
  });

  logger.info('Audit messaging, OutboxDispatcher, and Consumer started');
  return { publisher, outboxDispatcher };
}

export async function closeMessaging(): Promise<void> {
  if (consumer) {
    await consumer.stop().catch(() => {});
  }
  if (outboxDispatcher) {
    await outboxDispatcher.stop().catch(() => {});
  }
  if (rabbitConn) {
    await rabbitConn.close().catch(() => {});
  }
}

export function getPublisher(): EventPublisher {
  if (!publisher) {
    throw new Error('Publisher not initialized');
  }
  return publisher;
}

import {
  RabbitMQConnection,
  setupTopology,
  EventPublisher,
  OutboxDispatcher,
  IdempotentConsumer,
} from '@hvac/messaging';
import { env } from './env.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'technician-service:messaging' });

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
    queueName: 'q.technician_service',
    consumerGroup: 'technician-service',
    routingKeys: [
      'service.work_order.#',
      'inventory.transfer.#',
    ],
    retentionCategory: 'STANDARD',
  });

  await consumer.start(async (event) => {
    logger.info({ eventType: event.metadata.eventType }, 'Technician Service received domain event');
  });

  logger.info('Technician messaging, OutboxDispatcher, and Consumer started');
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

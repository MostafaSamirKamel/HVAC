import {
  RabbitMQConnection,
  setupTopology,
  EventPublisher,
  OutboxDispatcher,
  IdempotentConsumer,
} from '@hvac/messaging';
import { env } from './env.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'inventory-service:messaging' });

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

  // Assert Exchanges and DLX
  await setupTopology(confirmChannel);

  publisher = new EventPublisher(confirmChannel);
  outboxDispatcher = new OutboxDispatcher(publisher, 1500, 50);
  outboxDispatcher.start();

  // Consumer for inbound events (purchasing receipts, sales order fulfillment)
  consumer = new IdempotentConsumer(consumerChannel, {
    queueName: 'q.inventory_service',
    consumerGroup: 'inventory-service',
    routingKeys: [
      'purchasing.goods.received.#',
      'sales.order.#',
      'technician.workorder.#',
    ],
    retentionCategory: 'PERMANENT', // Rule 8: Permanent retention for inventory events
  });

  await consumer.start(async (event) => {
    logger.info({ eventType: event.metadata.eventType }, 'Inventory received domain event');
  });

  logger.info('Inventory messaging, OutboxDispatcher, and Consumer started');
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

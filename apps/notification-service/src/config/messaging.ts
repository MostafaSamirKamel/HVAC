import {
  RabbitMQConnection,
  setupTopology,
  EventPublisher,
  OutboxDispatcher,
  IdempotentConsumer,
} from '@hvac/messaging';
import { env } from './env.js';
import { createLogger } from '@hvac/logger';
import { NotificationService } from '../modules/notifications/notification.service.js';

const logger = createLogger({ serviceName: 'notification-service:messaging' });

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
    queueName: 'q.notification_service',
    consumerGroup: 'notification-service',
    routingKeys: [
      'installments.installment.overdue.#',
      'approval.request.#',
      'inventory.stock.low.#',
      'sales.sale.#',
      'technician.workorder.#',
    ],
    retentionCategory: 'STANDARD',
  });

  await consumer.start(async (event) => {
    try {
      const eventType = event.metadata?.eventType || '';
      logger.info({ eventType }, 'Notification Service received domain event');

      if (eventType.startsWith('installments.installment.overdue')) {
        await NotificationService.handleInstallmentOverdue(event);
      } else if (eventType.startsWith('approval.request')) {
        await NotificationService.handleApprovalRequested(event);
      } else if (eventType.startsWith('inventory.stock.low')) {
        await NotificationService.handleLowStockAlert(event);
      }
    } catch (err) {
      logger.error({ err, eventId: event.metadata?.eventId }, 'Failed to process notification domain event');
      throw err;
    }
  });

  logger.info('Notification messaging, OutboxDispatcher, and Consumer started');
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

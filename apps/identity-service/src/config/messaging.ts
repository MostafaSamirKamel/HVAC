import {
  RabbitMQConnection,
  setupTopology,
  EventPublisher,
  OutboxDispatcher,
} from '@hvac/messaging';
import { env } from './env.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'identity-service:messaging' });

let rabbitConn: RabbitMQConnection | null = null;
let publisher: EventPublisher | null = null;
let outboxDispatcher: OutboxDispatcher | null = null;

export async function initMessaging(): Promise<{
  publisher: EventPublisher;
  outboxDispatcher: OutboxDispatcher;
}> {
  rabbitConn = new RabbitMQConnection(env.RABBITMQ_URL);
  const confirmChannel = await rabbitConn.getConfirmChannel();

  // Ensure topic exchange and DLX topology are asserted
  await setupTopology(confirmChannel);

  publisher = new EventPublisher(confirmChannel);
  outboxDispatcher = new OutboxDispatcher(publisher, 1500, 50);

  // Start background outbox polling
  outboxDispatcher.start();
  logger.info('Identity messaging and OutboxDispatcher initialized');

  return { publisher, outboxDispatcher };
}

export async function closeMessaging(): Promise<void> {
  if (outboxDispatcher) {
    await outboxDispatcher.stop();
  }
  if (rabbitConn) {
    await rabbitConn.close();
  }
}

export function getPublisher(): EventPublisher {
  if (!publisher) {
    throw new Error('Publisher not initialized');
  }
  return publisher;
}

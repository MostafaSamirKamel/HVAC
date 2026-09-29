import { Channel } from 'amqplib';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'messaging:topology' });

export const HVAC_EVENTS_EXCHANGE = 'hvac.events.topic';
export const HVAC_DLX_EXCHANGE = 'hvac.dlx';
export const HVAC_DEAD_LETTER_QUEUE = 'q.dead_letter';

export async function setupTopology(channel: Channel): Promise<void> {
  // 1. Assert Dead Letter Exchange (Fanout)
  await channel.assertExchange(HVAC_DLX_EXCHANGE, 'fanout', { durable: true });

  // 2. Assert Dead Letter Queue and bind to DLX
  await channel.assertQueue(HVAC_DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(HVAC_DEAD_LETTER_QUEUE, HVAC_DLX_EXCHANGE, '');

  // 3. Assert Primary Topic Exchange
  await channel.assertExchange(HVAC_EVENTS_EXCHANGE, 'topic', { durable: true });

  logger.info(
    { exchange: HVAC_EVENTS_EXCHANGE, dlx: HVAC_DLX_EXCHANGE },
    'RabbitMQ Topology asserted successfully',
  );
}

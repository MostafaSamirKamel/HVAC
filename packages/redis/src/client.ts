import { Redis, RedisOptions } from 'ioredis';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'redis:client' });

export function createRedisClient(urlOrOptions: string | RedisOptions): Redis {
  const isTest = process.env.NODE_ENV === 'test';

  const defaultOptions: RedisOptions = {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: isTest,
    enableOfflineQueue: !isTest,
    retryStrategy: isTest
      ? () => null
      : (times: number) => (times > 5 ? null : Math.min(times * 100, 3000)),
  };

  const client =
    typeof urlOrOptions === 'string'
      ? new Redis(urlOrOptions, defaultOptions)
      : new Redis({
          ...defaultOptions,
          ...urlOrOptions,
        });

  client.on('connect', () => {
    logger.info('Connected to Redis');
  });

  client.on('error', (err: unknown) => {
    if (!isTest) {
      logger.error({ err }, 'Redis error');
    }
  });

  return client;
}

export async function pingRedis(client: Redis): Promise<boolean> {
  try {
    const res = await client.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

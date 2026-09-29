import { createRedisClient } from '@hvac/redis';
import { env } from './env.js';

type RedisClient = ReturnType<typeof createRedisClient>;

let redisClient: RedisClient | null = null;
let isRedisAvailable = true;

export function getRedisClient(): RedisClient | null {
  if (!isRedisAvailable) return null;

  if (!redisClient) {
    try {
      redisClient = createRedisClient(env.REDIS_URI);
      redisClient.on('error', () => {
        isRedisAvailable = false;
      });
    } catch {
      isRedisAvailable = false;
      return null;
    }
  }
  return redisClient;
}

export function isRedisHealthy(): boolean {
  return isRedisAvailable && redisClient?.status === 'ready';
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}

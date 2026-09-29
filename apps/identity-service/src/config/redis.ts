import { createRedisClient } from '@hvac/redis';
import { env } from './env.js';
import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient(env.REDIS_URI);
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}

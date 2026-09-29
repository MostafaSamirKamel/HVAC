import { createRedisClient, DistributedLock } from '@hvac/redis';
import { env } from './env.js';
import { Redis } from 'ioredis';

let redisClient: Redis | null = null;
let distLock: DistributedLock | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient(env.REDIS_URI);
  }
  return redisClient;
}

export function getDistributedLock(): DistributedLock {
  if (!distLock) {
    distLock = new DistributedLock(getRedisClient());
  }
  return distLock;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    distLock = null;
  }
}

import { createRedisClient, DistributedLock, CacheService } from '@hvac/redis';
import { env } from './env.js';

const redis = createRedisClient({
  host: env.REDIS_URI.includes('://') ? new URL(env.REDIS_URI).hostname : 'localhost',
  port: env.REDIS_URI.includes('://') ? parseInt(new URL(env.REDIS_URI).port || '6379') : 6379,
  lazyConnect: true,
  enableOfflineQueue: false,
});

export const distributedLock = new DistributedLock(redis);
export const cacheService = new CacheService(redis);

export async function closeRedis(): Promise<void> {
  if (redis.status !== 'end') {
    await redis.quit().catch(() => {});
  }
}

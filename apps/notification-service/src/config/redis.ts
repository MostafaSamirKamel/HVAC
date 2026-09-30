import { createRedisClient, DistributedLock, CacheService } from '@hvac/redis';
import { env } from './env.js';

const redis = createRedisClient(env.REDIS_URI);

export const distributedLock = new DistributedLock(redis);
export const cacheService = new CacheService(redis);

export async function closeRedis(): Promise<void> {
  if (redis.status !== 'end') {
    await redis.quit().catch(() => {});
  }
}

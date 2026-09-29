import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import { ConflictError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'redis:lock' });

const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface LockHandle {
  resource: string;
  token: string;
}

export class DistributedLock {
  constructor(private readonly redis: Redis) {}

  /**
   * Attempts to acquire an atomic distributed lock.
   * Returns a LockHandle if acquired, or null if contention is detected.
   */
  async acquire(resource: string, ttlMs = 5000): Promise<LockHandle | null> {
    const lockKey = `lock:${resource}`;
    const token = crypto.randomUUID();

    const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      logger.debug({ resource, ttlMs }, 'Acquired distributed lock');
      return { resource, token };
    }

    logger.debug({ resource }, 'Failed to acquire distributed lock (contention)');
    return null;
  }

  /**
   * Safely releases the distributed lock using a Lua script to ensure
   * only the token owner can delete the key.
   */
  async release(handle: LockHandle): Promise<boolean> {
    const lockKey = `lock:${handle.resource}`;
    try {
      const result = await this.redis.eval(
        RELEASE_LOCK_LUA_SCRIPT,
        1,
        lockKey,
        handle.token,
      );
      return result === 1;
    } catch (err) {
      logger.error({ err, resource: handle.resource }, 'Error releasing distributed lock');
      return false;
    }
  }

  /**
   * Executes a critical section with an acquired lock.
   * If lock cannot be acquired, throws ConflictError (409) to mitigate contention immediately.
   */
  async withLock<T>(
    resource: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const handle = await this.acquire(resource, ttlMs);
    if (!handle) {
      throw new ConflictError(`Resource '${resource}' is currently locked by another concurrent operation. Please retry.`);
    }

    try {
      return await operation();
    } finally {
      await this.release(handle);
    }
  }
}

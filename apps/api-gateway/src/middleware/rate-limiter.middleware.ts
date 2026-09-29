import { Request, Response, NextFunction } from 'express';
import { RateLimitExceededError } from '@hvac/errors';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface InMemoryRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, InMemoryRecord>();

// Clean up stale in-memory records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetTime <= now) {
      memoryStore.delete(key);
    }
  }
}, 30000).unref();

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 100;
  const windowSeconds = Math.ceil(windowMs / 1000);

  const defaultKeyGenerator = (req: Request): string => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    return userId ? `user:${userId}` : `ip:${ip}`;
  };

  const keyGenerator = options.keyGenerator || defaultKeyGenerator;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (options.skip && options.skip(req)) {
      return next();
    }

    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();

    let current = 0;
    let ttlSeconds = windowSeconds;

    let useMemory = false;
    try {
      if (process.env.NODE_ENV === 'test' && !process.env.TEST_WITH_REDIS) {
        useMemory = true;
      } else {
        const redis = getRedisClient();
        if (!redis) {
          useMemory = true;
        } else {
          current = await redis.incr(key);
          if (current === 1) {
            await redis.expire(key, windowSeconds);
          } else {
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
              ttlSeconds = ttl;
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Redis rate limiter failure; falling back to in-memory store');
      useMemory = true;
    }

    if (useMemory) {
      const record = memoryStore.get(key);
      if (!record || record.resetTime <= now) {
        current = 1;
        const resetTime = now + windowMs;
        memoryStore.set(key, { count: 1, resetTime });
        ttlSeconds = windowSeconds;
      } else {
        record.count += 1;
        current = record.count;
        ttlSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      }
    }

    const remaining = Math.max(0, max - current);
    const resetTimeUnix = Math.ceil(now / 1000) + ttlSeconds;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeUnix);

    if (current > max) {
      res.setHeader('Retry-After', ttlSeconds);
      return next(new RateLimitExceededError(`Rate limit exceeded. Maximum ${max} requests per ${windowSeconds}s.`));
    }

    next();
  };
}

export const rateLimiterMiddleware = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  skip: (req) => req.path.startsWith('/health') || req.path === '/metrics',
});

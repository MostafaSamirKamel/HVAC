import { Redis } from 'ioredis';

export class CacheService {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'hvac:cache:',
  ) {}

  private formatKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.formatKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const fullKey = this.formatKey(key);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(fullKey, serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(fullKey, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.formatKey(key));
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

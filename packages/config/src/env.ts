import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().default('mongodb://localhost:27017/hvac_erp?replicaSet=rs0'),
  REDIS_URI: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  JWT_SECRET: z.string().default('development-jwt-secret-do-not-use-in-production-12345'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function normalizeEnv(
  rawEnv: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const env = { ...rawEnv };

  // 1. Resolve MongoDB URI from MONGO_URI, MONGO_URL, or MONGO_PRIVATE_URL (Railway)
  const rawMongo = env.MONGO_URI || env.MONGO_URL || env.MONGO_PRIVATE_URL;
  if (rawMongo) {
    let normalized = rawMongo.trim();
    const match = normalized.match(/^(mongodb(?:\+srv)?:\/\/[^\/?#]+)(\/?[^?#]*)(\?.*)?$/i);
    if (match) {
      const base = match[1];
      let path = match[2];
      let query = match[3] || '';
      if (!path || path === '/') {
        path = '/hvac_erp';
      }
      const hasCredentials = /:\/\/[^@]+@/.test(base);
      if (hasCredentials && !query.includes('authSource=')) {
        query = query ? `${query}&authSource=admin` : '?authSource=admin';
      }
      normalized = `${base}${path}${query}`;
    }
    env.MONGO_URI = normalized;
    env.MONGO_URL = normalized;
  }

  // 2. Resolve Redis URI from REDIS_URI, REDIS_URL, or REDIS_PRIVATE_URL (Railway)
  const rawRedis = env.REDIS_URI || env.REDIS_URL || env.REDIS_PRIVATE_URL;
  if (rawRedis) {
    env.REDIS_URI = rawRedis.trim();
    env.REDIS_URL = rawRedis.trim();
  }

  // 3. Resolve RabbitMQ URL from RABBITMQ_URL or RABBITMQ_PRIVATE_URL (Railway)
  const rawRabbit = env.RABBITMQ_URL || env.RABBITMQ_PRIVATE_URL;
  if (rawRabbit) {
    env.RABBITMQ_URL = rawRabbit.trim();
  }

  return env;
}

export function validateEnv<T extends z.ZodRawShape>(
  extendedSchema: T,
): z.infer<typeof baseEnvSchema> & z.infer<z.ZodObject<T>>;
export function validateEnv(): z.infer<typeof baseEnvSchema>;
export function validateEnv<T extends z.ZodRawShape>(extendedSchema?: T) {
  const normalized = normalizeEnv(process.env);
  const schema = extendedSchema ? baseEnvSchema.extend(extendedSchema) : baseEnvSchema;
  const result = schema.safeParse(normalized);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Environment configuration validation failed');
  }

  return result.data as any;
}

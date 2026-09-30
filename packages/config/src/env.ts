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

  // 1. Resolve MongoDB URI
  let rawMongo = env.MONGO_URI || env.MONGO_URL || env.MONGO_PRIVATE_URL;
  if (rawMongo && (rawMongo.startsWith('${{') || rawMongo.includes('${{'))) {
    rawMongo = undefined;
  }
  if (!rawMongo && (env.MONGOHOST || env.MONGO_HOST)) {
    const host = env.MONGOHOST || env.MONGO_HOST;
    const port = env.MONGOPORT || env.MONGO_PORT || '27017';
    const user = env.MONGOUSER || env.MONGO_USER || env.MONGO_INITDB_ROOT_USERNAME;
    const pass = env.MONGOPASSWORD || env.MONGO_PASSWORD || env.MONGO_INITDB_ROOT_PASSWORD;
    if (user && pass) {
      rawMongo = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/hvac_erp?authSource=admin`;
    } else {
      rawMongo = `mongodb://${host}:${port}/hvac_erp`;
    }
  }
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

  // 2. Resolve Redis URI
  let rawRedis = env.REDIS_URI || env.REDIS_URL || env.REDIS_PRIVATE_URL;
  if (rawRedis && (rawRedis.startsWith('${{') || rawRedis.includes('${{'))) {
    rawRedis = undefined;
  }
  if (!rawRedis && (env.REDISHOST || env.REDIS_HOST)) {
    const host = env.REDISHOST || env.REDIS_HOST;
    const port = env.REDISPORT || env.REDIS_PORT || '6379';
    const user = env.REDISUSER || env.REDIS_USER || 'default';
    const pass = env.REDISPASSWORD || env.REDIS_PASSWORD;
    if (pass) {
      rawRedis = `redis://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
    } else {
      rawRedis = `redis://${host}:${port}`;
    }
  }
  if (rawRedis) {
    env.REDIS_URI = rawRedis.trim();
    env.REDIS_URL = rawRedis.trim();
  }

  // 3. Resolve RabbitMQ URL
  let rawRabbit = env.RABBITMQ_URL || env.RABBITMQ_PRIVATE_URL;
  if (rawRabbit && (rawRabbit.startsWith('${{') || rawRabbit.includes('${{'))) {
    rawRabbit = undefined;
  }
  if (!rawRabbit && (env.RABBITMQHOST || env.RABBITMQ_HOST)) {
    const host = env.RABBITMQHOST || env.RABBITMQ_HOST;
    const port = env.RABBITMQPORT || env.RABBITMQ_PORT || '5672';
    const user = env.RABBITMQUSER || env.RABBITMQ_USER || env.RABBITMQ_DEFAULT_USER || 'guest';
    const pass = env.RABBITMQPASSWORD || env.RABBITMQ_PASSWORD || env.RABBITMQ_DEFAULT_PASS || 'guest';
    rawRabbit = `amqp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
  }
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

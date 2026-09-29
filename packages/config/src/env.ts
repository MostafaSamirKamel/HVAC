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

export function validateEnv<T extends z.ZodRawShape>(
  extendedSchema: T,
): z.infer<typeof baseEnvSchema> & z.infer<z.ZodObject<T>>;
export function validateEnv(): z.infer<typeof baseEnvSchema>;
export function validateEnv<T extends z.ZodRawShape>(extendedSchema?: T) {
  const schema = extendedSchema ? baseEnvSchema.extend(extendedSchema) : baseEnvSchema;
  const result = schema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Environment configuration validation failed');
  }

  return result.data as any;
}

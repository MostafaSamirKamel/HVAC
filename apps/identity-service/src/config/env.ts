import { validateEnv, defaultServicePorts } from '@hvac/config';
import { z } from 'zod';

export const env = validateEnv({
  PORT: z.coerce.number().default(defaultServicePorts.identity),
  MONGO_URI: z.string().default('mongodb://localhost:27017/hvac_identity?replicaSet=rs0'),
  JWT_SECRET: z.string().default('hvac-jwt-access-secret-minimum-32-chars-long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  INTERNAL_SERVICE_SECRET: z.string().default('hvac-internal-signed-token-secret-minimum-32-chars'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  REDIS_URI: z.string().default('redis://localhost:6379'),
});

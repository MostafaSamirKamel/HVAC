import { validateEnv, defaultServicePorts } from '@hvac/config';
import { z } from 'zod';

export const env = validateEnv({
  PORT: z.coerce.number().default(defaultServicePorts.installment),
  MONGO_URI: z.string().default('mongodb://localhost:27017/hvac_installment?replicaSet=rs0'),
  INTERNAL_SERVICE_SECRET: z.string().default('hvac-internal-signed-token-secret-minimum-32-chars'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  REDIS_URI: z.string().default('redis://localhost:6379'),
});

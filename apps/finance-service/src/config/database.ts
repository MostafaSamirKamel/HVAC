import { connectDatabase as connect, disconnectDatabase as disconnect } from '@hvac/database';
import { env } from './env.js';

export async function connectDatabase() {
  return connect(env.MONGO_URI, { serviceName: 'finance-service' });
}

export async function disconnectDatabase() {
  return disconnect();
}

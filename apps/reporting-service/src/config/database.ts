import { connectDatabase as connect, disconnectDatabase as disconnect } from '@hvac/database';
import { env } from './env.js';

export async function connectDatabase() {
  // Rule 18: reporting-service connects with readPreference: 'secondaryPreferred' to offload secondary replica nodes
  return connect(env.MONGO_URI, {
    serviceName: 'reporting-service',
    readPreference: 'secondaryPreferred',
  });
}

export async function disconnectDatabase() {
  return disconnect();
}

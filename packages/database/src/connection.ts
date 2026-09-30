import mongoose, { ConnectOptions, Connection } from 'mongoose';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'database' });

export interface DatabaseConnectionOptions extends ConnectOptions {
  serviceName?: string;
}

export async function connectDatabase(
  uri: string,
  options: DatabaseConnectionOptions = {},
): Promise<Connection> {
  const { serviceName, ...mongoOptions } = options;
  const service = serviceName || 'unknown-service';

  const defaultOptions: ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority',
    ...mongoOptions,
  };

  try {
    logger.info({ uri: maskMongoUri(uri), service }, 'Connecting to MongoDB Replica Set...');
    await mongoose.connect(uri, defaultOptions);
    logger.info({ service }, 'Successfully connected to MongoDB');

    mongoose.connection.on('error', (err: unknown) => {
      logger.error({ err, service }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn({ service }, 'MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (err) {
    logger.fatal({ err, service }, 'Failed to connect to MongoDB');
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  }
}

function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  } catch {
    return 'mongodb://***';
  }
}

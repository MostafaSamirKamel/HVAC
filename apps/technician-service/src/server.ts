import { createApp } from './app.js';
import { env } from './config/env.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'technician-service' });

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 technician-service running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = () => {
    logger.info('Shutting down technician-service...');
    server.close(() => {
      logger.info('technician-service gracefully terminated');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start technician-service');
  process.exit(1);
});

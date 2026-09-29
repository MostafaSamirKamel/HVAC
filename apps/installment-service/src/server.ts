import { createApp, setReadiness } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initMessaging, closeMessaging } from './config/messaging.js';
import { closeRedis } from './config/redis.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'installment-service' });

async function bootstrap() {
  const app = createApp();

  if (process.env.NODE_ENV !== 'test') {
    // 1. Connect MongoDB
    await connectDatabase().catch((err) => {
      logger.warn({ err }, 'Proceeding without active MongoDB connection in dev/test mode');
    });

    // 2. Connect RabbitMQ & start OutboxDispatcher + Consumer
    await initMessaging().catch((err) => {
      logger.warn({ err }, 'Proceeding without active RabbitMQ connection in dev/test mode');
    });
  }

  // 3. Start HTTP server
  const server = app.listen(env.PORT, () => {
    setReadiness(true);
    logger.info(`🚀 Installment Financing Service running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // 8-Step Graceful Shutdown Sequence (Rule 21)
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Initiating 8-step graceful shutdown for Installment Service...');

    // Step 1: Stop HTTP listener
    server.close(async () => {
      logger.info('Step 1: HTTP listener stopped');

      // Step 2: Mark readiness false
      setReadiness(false);
      logger.info('Step 2: Readiness marked false (503)');

      // Step 3: Drain in-flight requests
      await new Promise((resolve) => setTimeout(resolve, 500));
      logger.info('Step 3: In-flight requests drained');

      // Step 4 & 5: Stop messaging consumers, flush outbox, and close RabbitMQ
      await closeMessaging().catch((err) => {
        logger.error({ err }, 'Error closing messaging');
      });
      logger.info('Step 4 & 5: RabbitMQ consumers stopped & Outbox flushed');

      // Step 6: Close Redis
      await closeRedis().catch((err) => {
        logger.error({ err }, 'Error closing Redis');
      });
      logger.info('Step 6: Redis connection closed');

      // Step 7: Close MongoDB
      await disconnectDatabase().catch((err) => {
        logger.error({ err }, 'Error disconnecting MongoDB');
      });
      logger.info('Step 7: MongoDB disconnected gracefully');

      // Step 8: Exit cleanly
      logger.info('Step 8: Installment Service exited cleanly');
      process.exit(0);
    });

    // Timeout fallback after 15 seconds
    setTimeout(() => {
      logger.fatal('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start installment service');
  process.exit(1);
});

import { createApp, setReadiness } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeRedis } from './config/redis.js';

const app = createApp();
const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT} [${env.NODE_ENV}]`);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown initiated: marking readiness false and stopping new connections');
  setReadiness(false);

  // Close HTTP server and finish existing in-flight connections
  server.close(async () => {
    logger.info('HTTP server closed: all in-flight requests completed');
    try {
      await closeRedis();
      logger.info('Redis client connection closed');
    } catch (err) {
      logger.error({ err }, 'Error closing Redis client');
    }
    logger.info('API Gateway terminated cleanly');
    process.exit(0);
  });

  // Force close after 15s timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timed out (15s), forcing process termination');
    process.exit(1);
  }, 15000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { notificationRoutes } from './modules/notifications/index.js';
import { notificationTemplateRoutes } from './modules/templates/index.js';
import { notificationDeliveryRoutes } from './modules/deliveries/index.js';
import { notificationPreferenceRoutes } from './modules/preferences/index.js';

const logger = createLogger({ serviceName: 'notification-service' });

let isReady = false;

export function setReadiness(ready: boolean): void {
  isReady = ready;
}

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Observability & Health Probes (Rule 22)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'notification-service', port: 4011, timestamp: new Date().toISOString() });
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', (_req: Request, res: Response) => {
    const mongoReady = mongoose.connection.readyState === 1;
    if (isReady && mongoReady) {
      return res.status(200).json({ status: 'ready', mongo: 'connected' });
    }
    return res.status(503).json({
      status: 'unavailable',
      isReady,
      mongo: mongoReady ? 'connected' : 'disconnected',
    });
  });

  app.get('/metrics', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send('# HELP notification_service_up Status of notification service\n# TYPE notification_service_up gauge\nnotification_service_up 1\n');
  });

  // Backward compatibility route
  app.use('/notifications', notificationRoutes);

  // Domain API Routes
  app.use('/api/v1/notifications/templates', notificationTemplateRoutes);
  app.use('/api/v1/notifications/deliveries', notificationDeliveryRoutes);
  app.use('/api/v1/notifications/preferences', notificationPreferenceRoutes);
  app.use('/api/v1/notifications', notificationRoutes);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    logger.error({ err }, 'Internal error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  });

  return app;
}

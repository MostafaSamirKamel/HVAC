import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { workOrderRoutes } from './modules/work-orders/work-order.routes.js';
import { warrantyRoutes } from './modules/warranties/warranty.routes.js';
import { serviceTicketRoutes } from './modules/service-tickets/service-ticket.routes.js';

const logger = createLogger({ serviceName: 'service-operations-service' });

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
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'service-operations-service', timestamp: new Date().toISOString() });
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
    res.send('# HELP service_operations_up Status of service operations\n# TYPE service_operations_up gauge\nservice_operations_up 1\n');
  });

  // Domain API Routes
  app.use('/api/v1/service/work-orders', workOrderRoutes);
  app.use('/api/v1/service/warranties', warrantyRoutes);
  app.use('/api/v1/service/tickets', serviceTicketRoutes);

  app.use('/api/v1/service-ops/work-orders', workOrderRoutes);
  app.use('/api/v1/service-ops/warranties', warrantyRoutes);
  app.use('/api/v1/service-ops/tickets', serviceTicketRoutes);

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

    logger.error({ err }, 'Unhandled exception in service-operations-service');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : err.message,
      },
    });
  });

  return app;
}

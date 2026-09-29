import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { technicianRoutes } from './modules/technicians/technician.routes.js';

const logger = createLogger({ serviceName: 'technician-service' });

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
    res.send('# HELP technician_service_up Status of technician service\n# TYPE technician_service_up gauge\ntechnician_service_up 1\n');
  });

  // Legacy health
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'technician-service', port: 4008, timestamp: new Date().toISOString() });
  });

  // Domain API Routes
  app.use('/api/v1/technicians', technicianRoutes);
  app.use('/technicians', technicianRoutes);

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

    logger.error({ err }, 'Unhandled exception in technician-service');
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

import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { reportingRoutes } from './modules/dashboard/index.js';
import { salesReportRoutes } from './modules/sales-reports/index.js';
import { inventoryReportRoutes } from './modules/inventory-reports/index.js';
import { technicianReportRoutes } from './modules/technician-reports/index.js';
import { financeReportRoutes } from './modules/finance-reports/index.js';

const logger = createLogger({ serviceName: 'reporting-service' });

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
    res.json({ status: 'ok', service: 'reporting-service', port: 4013, timestamp: new Date().toISOString() });
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
    res.send('# HELP reporting_service_up Status of reporting service\n# TYPE reporting_service_up gauge\nreporting_service_up 1\n');
  });

  // Backward compatibility route
  app.use('/reports', reportingRoutes);

  // Domain API Routes
  app.use('/api/v1/reports', reportingRoutes);
  app.use('/api/v1/reports/dashboard', reportingRoutes);
  app.use('/api/v1/reports/sales', salesReportRoutes);
  app.use('/api/v1/reports/inventory', inventoryReportRoutes);
  app.use('/api/v1/reports/technicians', technicianReportRoutes);
  app.use('/api/v1/reports/finance', financeReportRoutes);

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

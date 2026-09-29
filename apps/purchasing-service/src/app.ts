import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { supplierRoutes } from './modules/suppliers/supplier.routes.js';
import { purchaseOrderRoutes } from './modules/purchase-orders/purchase-order.routes.js';
import { goodsReceiptRoutes } from './modules/goods-receipts/goods-receipt.routes.js';
import { vendorBillRoutes } from './modules/vendor-invoices/vendor-bill.routes.js';
import { purchaseReturnRoutes } from './modules/purchase-returns/purchase-return.routes.js';
import { purchaseRequestRoutes } from './modules/purchase-requests/purchase-request.routes.js';
import { rfqRoutes } from './modules/rfqs/rfq.routes.js';

const logger = createLogger({ serviceName: 'purchasing-service' });

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
    res.status(200).json({ status: 'ok', service: 'purchasing-service', timestamp: new Date().toISOString() });
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
    res.send('# HELP purchasing_service_up Status of purchasing service\n# TYPE purchasing_service_up gauge\npurchasing_service_up 1\n');
  });

  // Domain API Routes
  app.use('/api/v1/purchasing/suppliers', supplierRoutes);
  app.use('/api/v1/purchasing/orders', purchaseOrderRoutes);
  app.use('/api/v1/purchasing/goods-receipts', goodsReceiptRoutes);
  app.use('/api/v1/purchasing/bills', vendorBillRoutes);
  app.use('/api/v1/purchasing/returns', purchaseReturnRoutes);
  app.use('/api/v1/purchasing/requests', purchaseRequestRoutes);
  app.use('/api/v1/purchasing/rfqs', rfqRoutes);

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

    logger.error({ err }, 'Unhandled exception in purchasing-service');
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

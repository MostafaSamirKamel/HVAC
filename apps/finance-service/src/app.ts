import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { AppError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { accountRoutes } from './modules/chart-of-accounts/account.routes.js';
import { journalEntryRoutes } from './modules/journal-entries/journal-entry.routes.js';
import { treasuryRoutes } from './modules/treasuries/treasury.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { cashTransferRoutes } from './modules/cash-transfers/cash-transfer.routes.js';
import { expenseRoutes } from './modules/expenses/index.js';
import { customerLedgerRoutes } from './modules/customer-ledger/index.js';
import { supplierLedgerRoutes } from './modules/supplier-ledger/index.js';
import { receivablesRoutes } from './modules/receivables/index.js';
import { payablesRoutes } from './modules/payables/index.js';
import { bankAccountRoutes } from './modules/bank-accounts/index.js';
import { periodRoutes } from './modules/financial-periods/index.js';
import { profitLossRoutes } from './modules/profit-loss/index.js';
import { cashFlowRoutes } from './modules/cash-flow/index.js';
import { dashboardRoutes } from './modules/financial-entries/index.js';

const logger = createLogger({ serviceName: 'finance-service' });

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
    res.status(200).json({ status: 'ok', service: 'finance-service', timestamp: new Date().toISOString() });
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
    res.send('# HELP finance_service_up Status of finance service\n# TYPE finance_service_up gauge\nfinance_service_up 1\n');
  });

  // Domain API Routes
  app.use('/api/v1/finance/accounts', accountRoutes);
  app.use('/api/v1/finance/journal-entries', journalEntryRoutes);
  app.use('/api/v1/finance/treasuries', treasuryRoutes);
  app.use('/api/v1/finance/payments', paymentRoutes);
  app.use('/api/v1/finance/cash-transfers', cashTransferRoutes);
  app.use('/api/v1/finance/expenses', expenseRoutes);
  app.use('/api/v1/finance/customer-ledger', customerLedgerRoutes);
  app.use('/api/v1/finance/supplier-ledger', supplierLedgerRoutes);
  app.use('/api/v1/finance/receivables', receivablesRoutes);
  app.use('/api/v1/finance/payables', payablesRoutes);
  app.use('/api/v1/finance/bank-accounts', bankAccountRoutes);
  app.use('/api/v1/finance/periods', periodRoutes);
  app.use('/api/v1/finance/profit-loss', profitLossRoutes);
  app.use('/api/v1/finance/cash-flow', cashFlowRoutes);
  app.use('/api/v1/finance/dashboard', dashboardRoutes);

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

    logger.error({ err }, 'Unhandled exception in finance-service');
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

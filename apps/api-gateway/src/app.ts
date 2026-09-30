import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { rateLimiterMiddleware } from './middleware/rate-limiter.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { serviceEndpoints } from './config/services.js';
import { logger } from './config/logger.js';
import { MetricsCollector } from '@hvac/observability';

let isReady = true;

export function setReadiness(ready: boolean) {
  isReady = ready;
}

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(correlationIdMiddleware);
  app.use(rateLimiterMiddleware);

  // Probes & Observability Endpoints (Rule 21 & Rule 22)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
  });

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'alive', uptime: process.uptime() });
  });

  app.get('/health/ready', (_req, res) => {
    if (isReady) {
      return res.status(200).json({ status: 'ready' });
    }
    return res.status(503).json({ status: 'terminating' });
  });

  app.get('/metrics', (_req, res) => {
    const metrics = MetricsCollector.flush();
    res.json({ success: true, count: metrics.length, metrics });
  });

  app.get('/health/system', async (_req, res) => {
    const services = [
      { name: 'identity', port: 4001 },
      { name: 'inventory', port: 4002 },
      { name: 'purchasing', port: 4003 },
      { name: 'customer', port: 4004 },
      { name: 'sales', port: 4005 },
      { name: 'installment', port: 4006 },
      { name: 'finance', port: 4007 },
      { name: 'technician', port: 4008 },
      { name: 'service-ops', port: 4009 },
      { name: 'approval', port: 4010 },
      { name: 'notification', port: 4011 },
      { name: 'audit', port: 4012 },
      { name: 'reporting', port: 4013 },
    ];

    const pingResults = await Promise.all(
      services.map(async (svc) => {
        try {
          const resp = await fetch(`http://127.0.0.1:${svc.port}/health/ready`, {
            signal: AbortSignal.timeout(2000),
          });
          const body = await resp.json().catch(async () => await resp.text());
          return { service: svc.name, port: svc.port, status: resp.status, ok: resp.ok, body };
        } catch (err: any) {
          return { service: svc.name, port: svc.port, error: err.message, code: err.code };
        }
      }),
    );

    const envKeys = Object.keys(process.env).filter(
      (k) =>
        k.startsWith('MONGO') ||
        k.startsWith('REDIS') ||
        k.startsWith('RABBIT') ||
        k.startsWith('IDENTITY') ||
        k === 'PORT' ||
        k === 'NODE_ENV',
    );

    const maskedEnv: Record<string, string> = {};
    for (const k of envKeys) {
      const v = process.env[k] || '';
      maskedEnv[k] = v.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    }

    res.json({
      gateway: 'ok',
      uptime: process.uptime(),
      services: pingResults,
      environment: maskedEnv,
    });
  });

  // Public Auth proxy (Identity Service)
  app.use(
    '/api/v1/auth',
    createProxyMiddleware({
      target: serviceEndpoints.identity,
      changeOrigin: true,
      pathRewrite: (path) => `/api/v1/auth${path.startsWith('/') ? path : `/${path}`}`,
      logger,
      on: {
        proxyReq: (proxyReq, req: any) => {
          if (req.headers['x-correlation-id']) {
            proxyReq.setHeader('x-correlation-id', req.headers['x-correlation-id']);
          }
        },
      },
    }),
  );

  // Public/Protected Companies proxy (Identity Service)
  app.use(
    '/api/v1/companies',
    (req, res, next) => {
      // Allow public creation of companies (onboarding)
      if (req.method === 'POST') {
        return next();
      }
      return authMiddleware(req, res, next);
    },
    createProxyMiddleware({
      target: serviceEndpoints.identity,
      changeOrigin: true,
      pathRewrite: (path) => `/api/v1/companies${path.startsWith('/') ? path : `/${path}`}`,
      logger,
      on: {
        proxyReq: (proxyReq, req: any) => {
          if (req.headers['x-internal-token']) {
            proxyReq.setHeader('x-internal-token', req.headers['x-internal-token']);
          }
          if (req.headers['x-correlation-id']) {
            proxyReq.setHeader('x-correlation-id', req.headers['x-correlation-id']);
          }
          if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
          }
          if (req.headers['x-company-id']) {
            proxyReq.setHeader('x-company-id', req.headers['x-company-id']);
          }
        },
      },
    }),
  );

  // Protected proxies to domain microservices (Rules 1-13)
  const protectedRoutes = [
    { prefix: '/api/v1/users', target: serviceEndpoints.identity },
    { prefix: '/api/v1/branches', target: serviceEndpoints.identity },
    { prefix: '/api/v1/roles', target: serviceEndpoints.identity },
    { prefix: '/api/v1/inventory', target: serviceEndpoints.inventory },
    { prefix: '/api/v1/purchasing', target: serviceEndpoints.purchasing },
    { prefix: '/api/v1/customers', target: serviceEndpoints.customer },
    { prefix: '/api/v1/sales', target: serviceEndpoints.sales },
    { prefix: '/api/v1/installments', target: serviceEndpoints.installment },
    { prefix: '/api/v1/finance', target: serviceEndpoints.finance },
    { prefix: '/api/v1/technicians', target: serviceEndpoints.technician },
    { prefix: '/api/v1/service-ops', target: serviceEndpoints.serviceOperations },
    { prefix: '/api/v1/approvals', target: serviceEndpoints.approval },
    { prefix: '/api/v1/notifications', target: serviceEndpoints.notification },
    { prefix: '/api/v1/audit', target: serviceEndpoints.audit },
    { prefix: '/api/v1/reports', target: serviceEndpoints.reporting },
  ];

  for (const route of protectedRoutes) {
    app.use(
      route.prefix,
      authMiddleware,
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathRewrite: (path) => `${route.prefix}${path.startsWith('/') ? path : `/${path}`}`,
        logger,
        on: {
          proxyReq: (proxyReq, req: any) => {
            if (req.headers['x-internal-token']) {
              proxyReq.setHeader('x-internal-token', String(req.headers['x-internal-token']));
            }
            if (req.headers['x-correlation-id']) {
              proxyReq.setHeader('x-correlation-id', String(req.headers['x-correlation-id']));
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', String(req.headers['x-user-id']));
            }
            if (req.headers['x-company-id']) {
              proxyReq.setHeader('x-company-id', String(req.headers['x-company-id']));
            }
            if (req.headers['x-branch-id']) {
              proxyReq.setHeader('x-branch-id', String(req.headers['x-branch-id']));
            }
          },
        },
      }),
    );
  }

  // 404 handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found on API Gateway',
      },
    });
  });

  // Centralized Error middleware
  app.use(errorMiddleware);

  return app;
}

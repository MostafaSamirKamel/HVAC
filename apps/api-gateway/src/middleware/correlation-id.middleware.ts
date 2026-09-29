import { Request, Response, NextFunction } from 'express';
import { CorrelationManager } from '@hvac/observability';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  CorrelationManager.run({ requestId, correlationId }, () => {
    next();
  });
}

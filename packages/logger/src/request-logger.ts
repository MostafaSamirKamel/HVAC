import { Logger } from './logger.js';

export interface RequestLogContext {
  method: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  requestId?: string;
  correlationId?: string;
  userId?: string;
}

export function logHttpRequest(logger: Logger, ctx: RequestLogContext) {
  const level = ctx.statusCode && ctx.statusCode >= 500 ? 'error' : ctx.statusCode && ctx.statusCode >= 400 ? 'warn' : 'info';
  logger[level]({
    type: 'HTTP_REQUEST',
    method: ctx.method,
    url: ctx.url,
    statusCode: ctx.statusCode,
    durationMs: ctx.durationMs,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    userId: ctx.userId,
  }, `HTTP ${ctx.method} ${ctx.url} - ${ctx.statusCode || ''} (${ctx.durationMs || 0}ms)`);
}

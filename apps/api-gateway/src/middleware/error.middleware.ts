import { Request, Response, NextFunction } from 'express';
import { AppError } from '@hvac/errors';
import { logger } from '../config/logger.js';

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err }, `Handled application error: ${err.message}`);
    return res.status(err.statusCode).json(err.toJSON());
  }

  logger.error({ err }, `Unhandled server error: ${err.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred',
    },
  });
}

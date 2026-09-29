import { Request, Response, NextFunction } from 'express';
import { verifyInternalToken, AuthContext } from '@hvac/auth-context';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '@hvac/errors';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export function requireInternalAuth(req: Request, _res: Response, next: NextFunction): void {
  const internalToken = (req.headers['x-internal-token'] as string) || (req.headers.authorization?.replace('Bearer ', ''));

  if (!internalToken) {
    return next(new UnauthorizedError('Missing authentication credentials'));
  }

  try {
    const authContext = verifyInternalToken(internalToken, env.INTERNAL_SERVICE_SECRET);
    req.authContext = authContext;
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired internal service token'));
  }
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authContext) {
      return next(new UnauthorizedError('Authentication context required'));
    }

    try {
      for (const p of permissions) {
        req.authContext.requirePermission(p);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

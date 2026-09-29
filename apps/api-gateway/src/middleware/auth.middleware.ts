import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '@hvac/errors';
import { CorrelationManager } from '@hvac/observability';
import { getRedisClient } from '../config/redis.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  companyId: string;
  roles: string[];
  permissions: string[];
  branchId?: string;
  allowedBranchIds?: string[];
  permissionVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const revokedTokensMemoryStore = new Set<string>();

export function revokeToken(token: string) {
  revokedTokensMemoryStore.add(token);
}

export function clearRevokedTokens() {
  revokedTokensMemoryStore.clear();
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const userJwtSecret = process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production-12345';
    const decoded = jwt.verify(token, userJwtSecret) as AuthenticatedUser;

    // Check token revocation list (Rule 15)
    if (revokedTokensMemoryStore.has(token)) {
      return next(new AuthenticationError('Token has been revoked'));
    }

    req.user = decoded;

    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-secret-hvac-erp-key-2026';
    const correlationId = CorrelationManager.getCorrelationId();

    // Generate short-lived signed internal token (60 seconds)
    const internalToken = jwt.sign(
      {
        sub: decoded.userId,
        email: decoded.email,
        companyId: decoded.companyId,
        branchId: decoded.branchId,
        allowedBranchIds: decoded.allowedBranchIds || (decoded.branchId ? [decoded.branchId] : []),
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
        permissionVersion: decoded.permissionVersion || 1,
        correlationId,
      },
      internalSecret,
      { expiresIn: '60s' },
    );

    // Propagate signed internal token and correlation headers to downstream services
    req.headers['x-internal-token'] = internalToken;
    req.headers['x-correlation-id'] = correlationId;
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-company-id'] = decoded.companyId;
    if (decoded.branchId) req.headers['x-branch-id'] = decoded.branchId;

    next();
  } catch (err: any) {
    if (err instanceof AuthenticationError) {
      return next(err);
    }
    next(new AuthenticationError('Invalid or expired token'));
  }
}

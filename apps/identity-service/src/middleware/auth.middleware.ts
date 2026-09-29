import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '@hvac/errors';

export interface AuthenticatedUserPayload {
  sub: string;
  companyId: string;
  userBranchId?: string;
  allowedBranchIds: string[];
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  permissionVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUserPayload;
    req.user = payload;
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const userPerms = new Set(req.user.permissions || []);
    const hasAll = requiredPermissions.every((perm) => userPerms.has(perm));

    if (!hasAll) {
      return next(new ForbiddenError(`Missing required permission: ${requiredPermissions.join(', ')}`));
    }

    next();
  };
}

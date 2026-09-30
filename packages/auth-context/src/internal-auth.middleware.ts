import jwt from 'jsonwebtoken';
import { AuthContext, UserTokenPayload } from './auth-context.js';
import { AuthenticationError } from '@hvac/errors';

export interface InternalTokenPayload {
  sub: string;
  email: string;
  companyId: string;
  branchId?: string;
  allowedBranchIds?: string[];
  roles: string[];
  permissions: string[];
  permissionVersion?: number;
  correlationId?: string;
}

export function verifyInternalToken(
  token: string,
  secret: string = process.env.INTERNAL_SERVICE_SECRET || 'hvac-internal-signed-token-secret-minimum-32-chars',
): AuthContext {
  try {
    const decoded = jwt.verify(token, secret) as InternalTokenPayload;
    const userPayload: UserTokenPayload = {
      userId: decoded.sub,
      email: decoded.email,
      companyId: decoded.companyId,
      branchId: decoded.branchId,
      allowedBranchIds: decoded.allowedBranchIds,
      roles: decoded.roles,
      permissions: decoded.permissions,
    };
    return new AuthContext(userPayload);
  } catch {
    throw new AuthenticationError('Invalid or expired internal service token');
  }
}

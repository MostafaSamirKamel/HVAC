import { TenantBranchScope, BranchScope } from './branch-scope.js';
import { PermissionContext } from './permission-context.js';
import { AuthorizationError } from '@hvac/errors';

export interface UserTokenPayload {
  userId: string;
  email: string;
  companyId: string;
  roles: string[];
  permissions: string[];
  branchId?: string;
  allowedBranchIds?: string[];
  isSuperAdmin?: boolean;
}

export class AuthContext {
  public readonly userId: string;
  public readonly email: string;
  public readonly companyId: string;
  public readonly branchId?: string;
  public readonly roles: string[];
  public readonly permissions: PermissionContext;
  public readonly branchScope: TenantBranchScope;

  constructor(payload: UserTokenPayload) {
    this.userId = payload.userId;
    this.email = payload.email;
    this.companyId = payload.companyId;
    this.branchId = payload.branchId;
    this.roles = payload.roles || [];
    this.permissions = new PermissionContext(payload.permissions || []);
    this.branchScope = new TenantBranchScope({
      companyId: payload.companyId,
      userBranchId: payload.branchId,
      allowedBranchIds: payload.allowedBranchIds,
      userId: payload.userId,
      isSuperAdmin: payload.isSuperAdmin || this.roles.includes('superadmin'),
    });
  }

  public requirePermission(permission: string): void {
    if (!this.permissions.has(permission)) {
      throw new AuthorizationError(`Missing required permission: ${permission}`);
    }
  }

  public requireBranchAccess(branchId: string): void {
    if (!this.branchScope.canAccessBranch(branchId)) {
      throw new AuthorizationError(`Access denied to branch ${branchId}`);
    }
  }
}

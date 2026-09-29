export interface TenantScopeOptions {
  companyId: string;
  userBranchId?: string;
  isSuperAdmin?: boolean;
  allowedBranchIds?: string[];
  userId?: string;
}

export class TenantBranchScope {
  public readonly companyId: string;
  public readonly userBranchId?: string;
  public readonly isSuperAdmin: boolean;
  public readonly allowedBranchIds: string[];
  public readonly userId?: string;

  constructor(options: TenantScopeOptions) {
    this.companyId = options.companyId;
    this.userBranchId = options.userBranchId;
    this.isSuperAdmin = !!options.isSuperAdmin;
    this.allowedBranchIds = options.allowedBranchIds || (options.userBranchId ? [options.userBranchId] : []);
    this.userId = options.userId;
  }

  public canAccessBranch(branchId: string): boolean {
    if (this.isSuperAdmin) return true;
    return this.allowedBranchIds.includes(branchId);
  }

  /**
   * Generates a MongoDB query filter that strictly guarantees multi-tenant isolation.
   * Every query ALWAYS begins with companyId, preventing any accidental cross-company data leakage.
   */
  public toMongoFilter(
    baseQuery: Record<string, unknown> = {},
    options: { branchField?: string; skipBranchIfSuperAdmin?: boolean } = {},
  ): Record<string, unknown> {
    const branchField = options.branchField || 'branchId';

    // Global SuperAdmin with no company context specified
    if (this.isSuperAdmin && !this.companyId) {
      return { ...baseQuery };
    }

    const filter: Record<string, unknown> = {
      ...baseQuery,
      companyId: this.companyId,
    };

    // If super admin within a company, or no specific branch assigned (e.g. general manager)
    if (this.isSuperAdmin && options.skipBranchIfSuperAdmin !== false) {
      return filter;
    }

    // Branch scoping
    if (this.allowedBranchIds.length === 1) {
      filter[branchField] = this.allowedBranchIds[0];
    } else if (this.allowedBranchIds.length > 1) {
      filter[branchField] = { $in: this.allowedBranchIds };
    }

    return filter;
  }
}

// Backward compatibility alias
export const BranchScope = TenantBranchScope;

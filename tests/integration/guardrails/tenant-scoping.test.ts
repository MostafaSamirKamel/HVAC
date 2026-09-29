import { describe, it, expect } from 'vitest';
import { TenantBranchScope } from '@hvac/auth-context';

describe('Phase 0 Guardrail: Multi-Company Tenant Scoping', () => {
  it('should always include companyId in queries to prevent cross-company data leakage', () => {
    const scope = new TenantBranchScope({
      companyId: 'company_egypt_01',
      userBranchId: 'branch_cairo_nasr_city',
      allowedBranchIds: ['branch_cairo_nasr_city'],
      isSuperAdmin: false,
    });

    const filter = scope.toMongoFilter({ status: 'ACTIVE' });

    expect(filter).toEqual({
      status: 'ACTIVE',
      companyId: 'company_egypt_01',
      branchId: 'branch_cairo_nasr_city',
    });
  });

  it('should scope to multiple authorized branches within the company', () => {
    const scope = new TenantBranchScope({
      companyId: 'company_egypt_01',
      allowedBranchIds: ['branch_cairo', 'branch_giza'],
      isSuperAdmin: false,
    });

    const filter = scope.toMongoFilter();

    expect(filter).toEqual({
      companyId: 'company_egypt_01',
      branchId: { $in: ['branch_cairo', 'branch_giza'] },
    });
  });

  it('should preserve companyId even when user is branch-independent (General Manager)', () => {
    const scope = new TenantBranchScope({
      companyId: 'company_egypt_01',
      isSuperAdmin: true,
    });

    const filter = scope.toMongoFilter();

    // Must be bound to company_egypt_01 and not leak across companies
    expect(filter).toEqual({
      companyId: 'company_egypt_01',
    });
  });
});

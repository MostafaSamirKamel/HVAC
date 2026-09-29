import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CompanyModel } from '../../../apps/identity-service/src/modules/companies/company.model.js';
import { BranchModel } from '../../../apps/identity-service/src/modules/branches/branch.model.js';
import { RoleModel } from '../../../apps/identity-service/src/modules/roles/role.model.js';
import { UserModel } from '../../../apps/identity-service/src/modules/users/user.model.js';
import { RefreshTokenModel } from '../../../apps/identity-service/src/modules/auth/refresh-token.model.js';
import { AuthService } from '../../../apps/identity-service/src/modules/auth/auth.service.js';
import { RoleService } from '../../../apps/identity-service/src/modules/roles/role.service.js';
import { UserService } from '../../../apps/identity-service/src/modules/users/user.service.js';
import { verifyInternalToken } from '@hvac/auth-context';
import { env } from '../../../apps/identity-service/src/config/env.js';
import { UnauthorizedError } from '@hvac/errors';

describe('Phase 1: Identity & Access Management Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Multi-Tenant Roles & Permissions', () => {
    it('should aggregate and deduplicate permissions across assigned roles', async () => {
      vi.spyOn(RoleModel, 'find').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce([
          {
            name: 'ACCOUNTANT',
            permissions: ['finance:journal:post', 'finance:treasury:collect', 'sales:orders:read'],
          },
          {
            name: 'SALES',
            permissions: ['sales:orders:create', 'sales:orders:read', 'customers:manage'],
          },
        ]),
      } as any);

      const permissions = await RoleService.getPermissionsForRoles('comp_eg_01', ['ACCOUNTANT', 'SALES']);

      // Deduplicated permissions
      expect(permissions).toContain('finance:journal:post');
      expect(permissions).toContain('finance:treasury:collect');
      expect(permissions).toContain('sales:orders:create');
      expect(permissions).toContain('sales:orders:read');
      expect(permissions).toContain('customers:manage');
      expect(permissions.filter((p) => p === 'sales:orders:read').length).toBe(1);
    });
  });

  describe('Authentication & Token Lifecycle', () => {
    it('should successfully authenticate active user, hash-match password, and issue access, refresh, and internal tokens', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 10);

      const mockUser = {
        _id: 'mongo_user_1',
        userId: 'usr_ahmed_101',
        username: 'ahmed_sales',
        email: 'ahmed@cairohvac.com',
        fullName: 'Ahmed Hassan',
        passwordHash,
        companyId: 'comp_cairo_hvac',
        userBranchId: 'br_nasr_city',
        allowedBranchIds: ['br_nasr_city', 'br_heliopolis'],
        roles: ['SALES'],
        isSuperAdmin: false,
        isActive: true,
        permissionVersion: 1,
      };

      vi.spyOn(UserModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(mockUser),
      } as any);

      vi.spyOn(RoleModel, 'find').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce([
          {
            name: 'SALES',
            permissions: ['sales:orders:create', 'sales:orders:read'],
          },
        ]),
      } as any);

      vi.spyOn(RefreshTokenModel, 'create').mockResolvedValueOnce({} as any);
      vi.spyOn(UserModel, 'updateOne').mockResolvedValueOnce({} as any);

      const loginResult = await AuthService.login(
        'comp_cairo_hvac',
        'ahmed_sales',
        'SecurePass123!',
        'corr_test_login_999',
      );

      // Verify JWT Access Token
      expect(loginResult.accessToken).toBeDefined();
      const decodedAccess = jwt.verify(loginResult.accessToken, env.JWT_SECRET) as any;
      expect(decodedAccess.sub).toBe('usr_ahmed_101');
      expect(decodedAccess.companyId).toBe('comp_cairo_hvac');
      expect(decodedAccess.allowedBranchIds).toEqual(['br_nasr_city', 'br_heliopolis']);
      expect(decodedAccess.permissions).toContain('sales:orders:create');

      // Verify Cryptographic Refresh Token
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.refreshToken.length).toBe(80); // 40 bytes hex

      // Verify Signed Internal Token for Microservice Interoperability
      expect(loginResult.internalToken).toBeDefined();
      const verifiedAuth = verifyInternalToken(loginResult.internalToken, env.INTERNAL_SERVICE_SECRET);
      expect(verifiedAuth.userId).toBe('usr_ahmed_101');
      expect(verifiedAuth.companyId).toBe('comp_cairo_hvac');
      expect(verifiedAuth.branchScope.userBranchId).toBe('br_nasr_city');
      expect(verifiedAuth.branchScope.allowedBranchIds).toEqual(['br_nasr_city', 'br_heliopolis']);
      expect(verifiedAuth.roles).toContain('SALES');
      expect(verifiedAuth.permissions.has('sales:orders:create')).toBe(true);
      expect(verifiedAuth.branchScope.canAccessBranch('br_nasr_city')).toBe(true);
      expect(verifiedAuth.branchScope.canAccessBranch('br_alexandria')).toBe(false);
    });

    it('should reject authentication on invalid password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword!', 10);

      const mockUser = {
        userId: 'usr_ahmed_101',
        companyId: 'comp_cairo_hvac',
        passwordHash,
        isActive: true,
      };

      vi.spyOn(UserModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(mockUser),
      } as any);

      await expect(
        AuthService.login('comp_cairo_hvac', 'ahmed@cairohvac.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject authentication for inactive/deactivated users', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 10);

      const mockUser = {
        userId: 'usr_deactivated_001',
        companyId: 'comp_cairo_hvac',
        passwordHash,
        isActive: false, // Inactive account
      };

      vi.spyOn(UserModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(mockUser),
      } as any);

      await expect(
        AuthService.login('comp_cairo_hvac', 'deactivated@cairohvac.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should prevent cross-company login (tenant isolation)', async () => {
      // User exists in company_A, but login is attempted with company_B
      vi.spyOn(UserModel, 'findOne').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(null),
      } as any);

      await expect(
        AuthService.login('company_B', 'user_from_company_A@domain.com', 'AnyPassword'),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});

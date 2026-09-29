import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { UserModel, UserDocument } from '../users/user.model.js';
import { RoleService } from '../roles/role.service.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '@hvac/errors';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  internalToken: string;
  expiresIn: string;
  user: {
    userId: string;
    username: string;
    email: string;
    fullName: string;
    companyId: string;
    userBranchId?: string;
    allowedBranchIds: string[];
    roles: string[];
    permissions: string[];
    isSuperAdmin: boolean;
  };
}

export class AuthService {
  /**
   * Authenticates user credentials and issues tokens.
   */
  static async login(
    companyId: string,
    identifier: string, // email or username
    password: string,
    correlationId?: string,
  ): Promise<LoginResult> {
    const cleanIdentifier = identifier.toLowerCase().trim();

    const user = await UserModel.findOne({
      companyId,
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
    }).exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials or account is inactive');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Resolve aggregated permissions from user roles
    const permissions = await RoleService.getPermissionsForRoles(companyId, user.roles);

    // Generate JWT access token
    const accessToken = jwt.sign(
      {
        sub: user.userId,
        companyId: user.companyId,
        userBranchId: user.userBranchId,
        allowedBranchIds: user.allowedBranchIds,
        roles: user.roles,
        permissions,
        isSuperAdmin: user.isSuperAdmin,
        permissionVersion: user.permissionVersion,
      },
      env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    // Generate refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshTokenModel.create({
      tokenId: `rtk_${crypto.randomUUID()}`,
      userId: user.userId,
      companyId: user.companyId,
      tokenHash,
      expiresAt,
      revoked: false,
    });

    // Update lastLoginAt
    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    // Generate signed internal token for downstream microservices
    const internalToken = this.mintInternalToken(user, permissions, correlationId);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      internalToken,
      expiresIn: '15m',
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        companyId: user.companyId,
        userBranchId: user.userBranchId,
        allowedBranchIds: user.allowedBranchIds,
        roles: user.roles,
        permissions,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  static async refresh(rawRefreshToken: string, correlationId?: string): Promise<LoginResult> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const storedToken = await RefreshTokenModel.findOne({
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).exec();

    if (!storedToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Revoke used token (token rotation)
    storedToken.revoked = true;
    await storedToken.save();

    const user = await UserModel.findOne({
      companyId: storedToken.companyId,
      userId: storedToken.userId,
      isActive: true,
    }).exec();

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const permissions = await RoleService.getPermissionsForRoles(user.companyId, user.roles);

    const accessToken = jwt.sign(
      {
        sub: user.userId,
        companyId: user.companyId,
        userBranchId: user.userBranchId,
        allowedBranchIds: user.allowedBranchIds,
        roles: user.roles,
        permissions,
        isSuperAdmin: user.isSuperAdmin,
        permissionVersion: user.permissionVersion,
      },
      env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshTokenModel.create({
      tokenId: `rtk_${crypto.randomUUID()}`,
      userId: user.userId,
      companyId: user.companyId,
      tokenHash: newTokenHash,
      expiresAt,
      revoked: false,
    });

    const internalToken = this.mintInternalToken(user, permissions, correlationId);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      internalToken,
      expiresIn: '15m',
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        companyId: user.companyId,
        userBranchId: user.userBranchId,
        allowedBranchIds: user.allowedBranchIds,
        roles: user.roles,
        permissions,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  /**
   * Revokes a refresh token on logout.
   */
  static async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await RefreshTokenModel.updateOne({ tokenHash }, { $set: { revoked: true } });
  }

  /**
   * Generates a signed short-lived (60s) internal JWT containing authenticated tenant context.
   */
  static mintInternalToken(
    user: UserDocument,
    permissions: string[],
    correlationId: string = crypto.randomUUID(),
  ): string {
    return jwt.sign(
      {
        sub: user.userId,
        companyId: user.companyId,
        branchId: user.userBranchId || null,
        allowedBranchIds: user.allowedBranchIds,
        roles: user.roles,
        permissions,
        isSuperAdmin: user.isSuperAdmin,
        permissionVersion: user.permissionVersion,
        correlationId,
      },
      env.INTERNAL_SERVICE_SECRET,
      { expiresIn: '60s' },
    );
  }
}

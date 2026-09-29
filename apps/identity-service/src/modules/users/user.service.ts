import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { UserModel, UserDocument } from './user.model.js';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { UserCreatedEvent } from '@hvac/event-contracts';
import { ConflictError, NotFoundError } from '@hvac/errors';

export interface CreateUserInput {
  companyId: string;
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roles: string[];
  userBranchId?: string;
  allowedBranchIds?: string[];
  isSuperAdmin?: boolean;
}

export class UserService {
  static async createUser(input: CreateUserInput): Promise<UserDocument> {
    const cleanEmail = input.email.toLowerCase().trim();
    const cleanUsername = input.username.toLowerCase().trim();

    const existingEmail = await UserModel.findOne({
      companyId: input.companyId,
      email: cleanEmail,
    });
    if (existingEmail) {
      throw new ConflictError(`Email '${cleanEmail}' is already registered in this company`);
    }

    const existingUsername = await UserModel.findOne({
      companyId: input.companyId,
      username: cleanUsername,
    });
    if (existingUsername) {
      throw new ConflictError(`Username '${cleanUsername}' is already taken in this company`);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;

    const allowedBranchIds = input.allowedBranchIds || (input.userBranchId ? [input.userBranchId] : []);

    return withTransaction(async (session) => {
      const [user] = await UserModel.create(
        [
          {
            companyId: input.companyId,
            userId,
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            fullName: input.fullName.trim(),
            phone: input.phone,
            roles: input.roles.map((r) => r.toUpperCase()),
            userBranchId: input.userBranchId,
            allowedBranchIds,
            isSuperAdmin: !!input.isSuperAdmin,
            isActive: true,
            permissionVersion: 1,
            schemaVersion: 1,
          },
        ],
        { session },
      );

      const event = new UserCreatedEvent(
        {
          userId: user.userId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
          userBranchId: user.userBranchId,
          allowedBranchIds: user.allowedBranchIds,
          isSuperAdmin: user.isSuperAdmin,
        },
        {
          companyId: user.companyId,
          branchId: user.userBranchId,
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return user;
    });
  }

  static async getUserById(companyId: string, userId: string): Promise<UserDocument> {
    const user = await UserModel.findOne({ companyId, userId }).exec();
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found in company '${companyId}'`);
    }
    return user;
  }

  static async listUsers(companyId: string, branchId?: string): Promise<UserDocument[]> {
    const filter: Record<string, unknown> = { companyId, isActive: true };
    if (branchId) {
      filter.allowedBranchIds = branchId;
    }
    return UserModel.find(filter).sort({ fullName: 1 }).exec();
  }

  static async updateUserRoles(
    companyId: string,
    userId: string,
    roles: string[],
    userBranchId?: string,
    allowedBranchIds?: string[],
  ): Promise<UserDocument> {
    const update: Record<string, unknown> = {
      roles: roles.map((r) => r.toUpperCase()),
      $inc: { permissionVersion: 1 }, // Invalidates older cached tokens
    };

    if (userBranchId !== undefined) {
      update.userBranchId = userBranchId;
    }
    if (allowedBranchIds !== undefined) {
      update.allowedBranchIds = allowedBranchIds;
    }

    const updated = await UserModel.findOneAndUpdate(
      { companyId, userId },
      update,
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError(`User '${userId}' not found in company '${companyId}'`);
    }
    return updated;
  }
}

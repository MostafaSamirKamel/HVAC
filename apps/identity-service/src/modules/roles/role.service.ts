import { ClientSession } from 'mongoose';
import { RoleModel, RoleDocument } from './role.model.js';
import { DefaultRoleDefinitions } from './permissions.constants.js';
import { ConflictError, NotFoundError } from '@hvac/errors';

export class RoleService {
  /**
   * Seeds the default system roles for a given company.
   */
  static async seedDefaultRoles(companyId: string, session?: ClientSession): Promise<RoleDocument[]> {
    const rolesToCreate = Object.entries(DefaultRoleDefinitions).map(([name, def]) => ({
      companyId,
      name,
      displayName: def.displayName,
      permissions: def.permissions,
      isSystemRole: true,
      schemaVersion: 1,
    }));

    return RoleModel.insertMany(rolesToCreate, { session }) as unknown as Promise<RoleDocument[]>;
  }

  static async listRoles(companyId: string): Promise<RoleDocument[]> {
    return RoleModel.find({ companyId }).sort({ name: 1 }).exec();
  }

  static async getRoleByName(companyId: string, name: string): Promise<RoleDocument> {
    const role = await RoleModel.findOne({ companyId, name: name.toUpperCase() }).exec();
    if (!role) {
      throw new NotFoundError(`Role '${name}' not found for company '${companyId}'`);
    }
    return role;
  }

  static async createCustomRole(
    companyId: string,
    name: string,
    displayName: string,
    permissions: string[],
  ): Promise<RoleDocument> {
    const upperName = name.toUpperCase().trim();
    const existing = await RoleModel.findOne({ companyId, name: upperName });
    if (existing) {
      throw new ConflictError(`Role '${upperName}' already exists in company '${companyId}'`);
    }

    return RoleModel.create({
      companyId,
      name: upperName,
      displayName,
      permissions,
      isSystemRole: false,
      schemaVersion: 1,
    });
  }

  /**
   * Resolves and deduplicates permissions across all roles assigned to a user.
   */
  static async getPermissionsForRoles(companyId: string, roleNames: string[]): Promise<string[]> {
    if (!roleNames || roleNames.length === 0) return [];

    const roles = await RoleModel.find({
      companyId,
      name: { $in: roleNames.map((r) => r.toUpperCase()) },
    }).exec();

    const permissionSet = new Set<string>();
    for (const r of roles) {
      for (const p of r.permissions) {
        permissionSet.add(p);
      }
    }
    return Array.from(permissionSet);
  }
}

export class PermissionContext {
  private readonly permissions: Set<string>;

  constructor(permissions: string[] = []) {
    this.permissions = new Set(permissions);
  }

  public has(permission: string): boolean {
    if (this.permissions.has('*') || this.permissions.has('admin')) {
      return true;
    }
    return this.permissions.has(permission);
  }

  public hasAny(permissions: string[]): boolean {
    return permissions.some((p) => this.has(p));
  }

  public hasAll(permissions: string[]): boolean {
    return permissions.every((p) => this.has(p));
  }

  public toArray(): string[] {
    return Array.from(this.permissions);
  }
}

import { Schema, Document } from 'mongoose';

export interface TenantDocument extends Document {
  companyId: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export function tenantPlugin(schema: Schema): void {
  // Ensure companyId is present
  if (!schema.path('companyId')) {
    schema.add({
      companyId: {
        type: String,
        required: [true, 'companyId is strictly required for multi-tenant isolation'],
        index: true,
      },
    });
  }

  // Ensure schemaVersion is present
  if (!schema.path('schemaVersion')) {
    schema.add({
      schemaVersion: {
        type: Number,
        default: 1,
        required: true,
      },
    });
  }

  // Hook to validate presence on validation
  schema.pre('validate', function (this: TenantDocument, next: (err?: Error) => void) {
    if (!this.get('companyId')) {
      return next(new Error('Tenant boundary violation: companyId must be provided'));
    }
    next();
  });
}

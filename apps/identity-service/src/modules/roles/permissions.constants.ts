export const SystemPermissions = {
  // Identity & Organization
  IDENTITY_USERS_CREATE: 'identity:users:create',
  IDENTITY_USERS_READ: 'identity:users:read',
  IDENTITY_USERS_UPDATE: 'identity:users:update',
  IDENTITY_USERS_DELETE: 'identity:users:delete',
  IDENTITY_ROLES_MANAGE: 'identity:roles:manage',
  IDENTITY_BRANCHES_MANAGE: 'identity:branches:manage',

  // Catalog & Inventory
  INVENTORY_PRODUCTS_READ: 'inventory:products:read',
  INVENTORY_PRODUCTS_WRITE: 'inventory:products:write',
  INVENTORY_STOCK_READ: 'inventory:stock:read',
  INVENTORY_STOCK_ADJUST: 'inventory:stock:adjust',
  INVENTORY_STOCK_TRANSFER: 'inventory:stock:transfer',
  INVENTORY_SERIALS_MANAGE: 'inventory:serials:manage',

  // Sales & CRM
  SALES_ORDERS_CREATE: 'sales:orders:create',
  SALES_ORDERS_READ: 'sales:orders:read',
  SALES_ORDERS_CANCEL: 'sales:orders:cancel',
  SALES_INVOICES_CREATE: 'sales:invoices:create',
  SALES_DISCOUNTS_APPLY: 'sales:discounts:apply',
  CUSTOMERS_MANAGE: 'customers:manage',
  CUSTOMERS_READ: 'customers:read',

  // Finance & Treasury
  FINANCE_JOURNAL_READ: 'finance:journal:read',
  FINANCE_JOURNAL_POST: 'finance:journal:post',
  FINANCE_TREASURY_COLLECT: 'finance:treasury:collect',
  FINANCE_TREASURY_TRANSFER: 'finance:treasury:transfer',
  FINANCE_EXPENSES_MANAGE: 'finance:expenses:manage',

  // Purchasing
  PURCHASING_ORDERS_CREATE: 'purchasing:orders:create',
  PURCHASING_ORDERS_READ: 'purchasing:orders:read',
  PURCHASING_BILLS_MANAGE: 'purchasing:bills:manage',

  // Technicians & Operations
  SERVICE_WORKORDERS_CREATE: 'service:workorders:create',
  SERVICE_WORKORDERS_ASSIGN: 'service:workorders:assign',
  SERVICE_WORKORDERS_COMPLETE: 'service:workorders:complete',
  SERVICE_CUSTODY_MANAGE: 'service:custody:manage',

  // Approvals & Audit
  APPROVALS_DECIDE: 'approvals:decide',
  AUDIT_LOG_READ: 'audit:log:read',

  // Reports
  REPORTS_DASHBOARD_VIEW: 'reports:dashboard:view',
  REPORTS_FINANCIAL_VIEW: 'reports:financial:view',
  REPORTS_INVENTORY_VIEW: 'reports:inventory:view',
  REPORTS_EXPORT: 'reports:export',
} as const;

export type SystemPermission = (typeof SystemPermissions)[keyof typeof SystemPermissions];

export const DefaultRoleDefinitions: Record<string, { displayName: string; permissions: string[] }> = {
  SUPER_ADMIN: {
    displayName: 'مدير النظام العام',
    permissions: Object.values(SystemPermissions),
  },
  GENERAL_MANAGER: {
    displayName: 'المدير العام',
    permissions: Object.values(SystemPermissions),
  },
  BRANCH_MANAGER: {
    displayName: 'مدير الفرع',
    permissions: [
      SystemPermissions.IDENTITY_USERS_READ,
      SystemPermissions.INVENTORY_PRODUCTS_READ,
      SystemPermissions.INVENTORY_STOCK_READ,
      SystemPermissions.INVENTORY_STOCK_TRANSFER,
      SystemPermissions.SALES_ORDERS_CREATE,
      SystemPermissions.SALES_ORDERS_READ,
      SystemPermissions.SALES_INVOICES_CREATE,
      SystemPermissions.SALES_DISCOUNTS_APPLY,
      SystemPermissions.CUSTOMERS_MANAGE,
      SystemPermissions.CUSTOMERS_READ,
      SystemPermissions.FINANCE_TREASURY_COLLECT,
      SystemPermissions.FINANCE_TREASURY_TRANSFER,
      SystemPermissions.FINANCE_EXPENSES_MANAGE,
      SystemPermissions.APPROVALS_DECIDE,
      SystemPermissions.REPORTS_DASHBOARD_VIEW,
      SystemPermissions.REPORTS_INVENTORY_VIEW,
    ],
  },
  ACCOUNTANT: {
    displayName: 'محاسب',
    permissions: [
      SystemPermissions.FINANCE_JOURNAL_READ,
      SystemPermissions.FINANCE_JOURNAL_POST,
      SystemPermissions.FINANCE_TREASURY_COLLECT,
      SystemPermissions.FINANCE_TREASURY_TRANSFER,
      SystemPermissions.FINANCE_EXPENSES_MANAGE,
      SystemPermissions.SALES_INVOICES_CREATE,
      SystemPermissions.SALES_ORDERS_READ,
      SystemPermissions.PURCHASING_BILLS_MANAGE,
      SystemPermissions.CUSTOMERS_READ,
      SystemPermissions.REPORTS_FINANCIAL_VIEW,
      SystemPermissions.REPORTS_DASHBOARD_VIEW,
    ],
  },
  CASHIER: {
    displayName: 'أمين خزينة / كاشير',
    permissions: [
      SystemPermissions.FINANCE_TREASURY_COLLECT,
      SystemPermissions.SALES_ORDERS_READ,
      SystemPermissions.SALES_INVOICES_CREATE,
      SystemPermissions.CUSTOMERS_READ,
    ],
  },
  SALES: {
    displayName: 'مسؤول مبيعات',
    permissions: [
      SystemPermissions.SALES_ORDERS_CREATE,
      SystemPermissions.SALES_ORDERS_READ,
      SystemPermissions.CUSTOMERS_MANAGE,
      SystemPermissions.CUSTOMERS_READ,
      SystemPermissions.INVENTORY_PRODUCTS_READ,
      SystemPermissions.INVENTORY_STOCK_READ,
    ],
  },
  WAREHOUSE_MANAGER: {
    displayName: 'أمين مخزن',
    permissions: [
      SystemPermissions.INVENTORY_PRODUCTS_READ,
      SystemPermissions.INVENTORY_STOCK_READ,
      SystemPermissions.INVENTORY_STOCK_ADJUST,
      SystemPermissions.INVENTORY_STOCK_TRANSFER,
      SystemPermissions.INVENTORY_SERIALS_MANAGE,
    ],
  },
  TECHNICAL_SUPERVISOR: {
    displayName: 'مشرف فنيين',
    permissions: [
      SystemPermissions.SERVICE_WORKORDERS_CREATE,
      SystemPermissions.SERVICE_WORKORDERS_ASSIGN,
      SystemPermissions.SERVICE_WORKORDERS_COMPLETE,
      SystemPermissions.SERVICE_CUSTODY_MANAGE,
      SystemPermissions.INVENTORY_STOCK_READ,
    ],
  },
  TECHNICIAN: {
    displayName: 'فني تكييف',
    permissions: [
      SystemPermissions.SERVICE_WORKORDERS_COMPLETE,
      SystemPermissions.INVENTORY_STOCK_READ,
    ],
  },
};

export interface ServiceEndpoints {
  identity: string;
  inventory: string;
  purchasing: string;
  customer: string;
  sales: string;
  installment: string;
  finance: string;
  technician: string;
  serviceOperations: string;
  approval: string;
  notification: string;
  audit: string;
  reporting: string;
}

export const defaultServicePorts = {
  identity: 4001,
  inventory: 4002,
  purchasing: 4003,
  customer: 4004,
  sales: 4005,
  installment: 4006,
  finance: 4007,
  technician: 4008,
  serviceOperations: 4009,
  approval: 4010,
  notification: 4011,
  audit: 4012,
  reporting: 4013,
} as const;

export function getServiceEndpoints(): ServiceEndpoints {
  return {
    identity: process.env.IDENTITY_SERVICE_URL || `http://localhost:${defaultServicePorts.identity}`,
    inventory: process.env.INVENTORY_SERVICE_URL || `http://localhost:${defaultServicePorts.inventory}`,
    purchasing: process.env.PURCHASING_SERVICE_URL || `http://localhost:${defaultServicePorts.purchasing}`,
    customer: process.env.CUSTOMER_SERVICE_URL || `http://localhost:${defaultServicePorts.customer}`,
    sales: process.env.SALES_SERVICE_URL || `http://localhost:${defaultServicePorts.sales}`,
    installment: process.env.INSTALLMENT_SERVICE_URL || `http://localhost:${defaultServicePorts.installment}`,
    finance: process.env.FINANCE_SERVICE_URL || `http://localhost:${defaultServicePorts.finance}`,
    technician: process.env.TECHNICIAN_SERVICE_URL || `http://localhost:${defaultServicePorts.technician}`,
    serviceOperations: process.env.SERVICE_OPERATIONS_SERVICE_URL || `http://localhost:${defaultServicePorts.serviceOperations}`,
    approval: process.env.APPROVAL_SERVICE_URL || `http://localhost:${defaultServicePorts.approval}`,
    notification: process.env.NOTIFICATION_SERVICE_URL || `http://localhost:${defaultServicePorts.notification}`,
    audit: process.env.AUDIT_SERVICE_URL || `http://localhost:${defaultServicePorts.audit}`,
    reporting: process.env.REPORTING_SERVICE_URL || `http://localhost:${defaultServicePorts.reporting}`,
  };
}

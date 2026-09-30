/**
 * Comprehensive QA Test Suite - Hands-on Exploratory Inspection
 * Runs automated tests across all 14 microservices and 50+ endpoints.
 */

const BASE_URL = process.env.BASE_URL || 'https://hvac-production-65d5.up.railway.app';

async function runQa() {
  console.log('--- STARTING QA TEST INSPECTION ON:', BASE_URL, '---');

  // 1. Login to get Super Admin token
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: 'comp_ahram_hvac',
      identifier: 'ahram_admin',
      password: 'AdminPassword@2026!',
    }),
  });

  const loginData = await loginRes.json();
  const token = loginData?.data?.accessToken;
  if (!token) {
    console.error('CRITICAL: Login failed:', loginData);
    process.exit(1);
  }

  const results = [];

  const endpoints = [
    // 1. Gateway & System Probes
    { category: 'System Probes', method: 'GET', path: '/health', auth: false },
    { category: 'System Probes', method: 'GET', path: '/health/system', auth: false },
    { category: 'System Probes', method: 'GET', path: '/metrics', auth: false },

    // 2. Identity Service
    { category: 'Identity', method: 'GET', path: '/api/v1/auth/me', auth: true },
    { category: 'Identity', method: 'GET', path: '/api/v1/companies', auth: true },
    { category: 'Identity', method: 'GET', path: '/api/v1/users', auth: true },
    { category: 'Identity', method: 'GET', path: '/api/v1/roles', auth: true },
    { category: 'Identity', method: 'GET', path: '/api/v1/branches', auth: true },

    // 3. Inventory Service
    { category: 'Inventory', method: 'GET', path: '/api/v1/inventory/products', auth: true },
    { category: 'Inventory', method: 'GET', path: '/api/v1/inventory/warehouses', auth: true },
    { category: 'Inventory', method: 'GET', path: '/api/v1/inventory/reservations', auth: true },

    // 4. Customer Service
    { category: 'Customer', method: 'GET', path: '/api/v1/customers', auth: true },
    { category: 'Customer', method: 'GET', path: '/api/v1/customers/equipment', auth: true },

    // 5. Sales Service
    { category: 'Sales', method: 'GET', path: '/api/v1/sales/orders', auth: true },
    { category: 'Sales', method: 'GET', path: '/api/v1/sales/invoices', auth: true },
    { category: 'Sales', method: 'GET', path: '/api/v1/sales/price-lists', auth: true },

    // 6. Purchasing Service
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/suppliers', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/orders', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/goods-receipts', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/bills', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/returns', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/requests', auth: true },
    { category: 'Purchasing', method: 'GET', path: '/api/v1/purchasing/rfqs', auth: true },

    // 7. Finance Service
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/accounts', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/bank-accounts', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/treasuries', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/journal-entries', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/payments', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/expenses', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/customer-ledger', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/supplier-ledger', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/receivables', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/payables', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/periods', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/profit-loss', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/cash-flow', auth: true },
    { category: 'Finance', method: 'GET', path: '/api/v1/finance/dashboard', auth: true },

    // 8. Installment Service
    { category: 'Installment', method: 'GET', path: '/api/v1/installments/contracts', auth: true },
    { category: 'Installment', method: 'GET', path: '/api/v1/installments/schedules', auth: true },
    { category: 'Installment', method: 'GET', path: '/api/v1/installments/overdue', auth: true },

    // 9. Technician Service
    { category: 'Technician', method: 'GET', path: '/api/v1/technicians', auth: true },

    // 10. Service Operations Service
    { category: 'Service Ops', method: 'GET', path: '/api/v1/service-ops/tickets', auth: true },
    { category: 'Service Ops', method: 'GET', path: '/api/v1/service-ops/work-orders', auth: true },
    { category: 'Service Ops', method: 'GET', path: '/api/v1/service-ops/warranties', auth: true },

    // 11. Approval Service
    { category: 'Approval', method: 'GET', path: '/api/v1/approvals/requests', auth: true },
    { category: 'Approval', method: 'GET', path: '/api/v1/approvals/rules', auth: true },
    { category: 'Approval', method: 'GET', path: '/api/v1/approvals/steps', auth: true },
    { category: 'Approval', method: 'GET', path: '/api/v1/approvals/history', auth: true },

    // 12. Notification Service
    { category: 'Notification', method: 'GET', path: '/api/v1/notifications', auth: true },
    { category: 'Notification', method: 'GET', path: '/api/v1/notifications/templates', auth: true },
    { category: 'Notification', method: 'GET', path: '/api/v1/notifications/deliveries', auth: true },
    { category: 'Notification', method: 'GET', path: '/api/v1/notifications/preferences', auth: true },

    // 13. Audit Service
    { category: 'Audit', method: 'GET', path: '/api/v1/audit/logs', auth: true },
    { category: 'Audit', method: 'GET', path: '/api/v1/audit/security', auth: true },
    { category: 'Audit', method: 'GET', path: '/api/v1/audit/activity', auth: true },

    // 14. Reporting Service
    { category: 'Reporting', method: 'GET', path: '/api/v1/reports/dashboard', auth: true },
    { category: 'Reporting', method: 'GET', path: '/api/v1/reports/sales', auth: true },
    { category: 'Reporting', method: 'GET', path: '/api/v1/reports/inventory', auth: true },
    { category: 'Reporting', method: 'GET', path: '/api/v1/reports/technicians', auth: true },
    { category: 'Reporting', method: 'GET', path: '/api/v1/reports/finance', auth: true },
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const headers = { 'Content-Type': 'application/json' };
    if (ep.auth) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers,
      });
      const latency = Date.now() - start;
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 100);
      }

      results.push({
        category: ep.category,
        method: ep.method,
        path: ep.path,
        status: res.status,
        latencyMs: latency,
        bodySnippet: typeof body === 'object' ? JSON.stringify(body).slice(0, 120) : String(body).slice(0, 120),
        ok: res.ok,
      });
    } catch (err) {
      results.push({
        category: ep.category,
        method: ep.method,
        path: ep.path,
        status: 'FETCH_ERROR',
        latencyMs: Date.now() - start,
        error: err.message,
        ok: false,
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

runQa().catch(console.error);

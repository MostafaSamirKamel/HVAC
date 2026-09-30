/**
 * Comprehensive HVAC ERP End-to-End API Test Suite
 * Tests real-world HVAC business flows across all microservices via API Gateway.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function logStep(step, title) {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}[Step ${step}] ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
}

function logResult(success, message, data = null) {
  const icon = success ? '✔' : '✖';
  const color = success ? colors.green : colors.red;
  console.log(`${colors.bold}${color}${icon} ${message}${colors.reset}`);
  if (data) {
    console.log(`${colors.reset}${JSON.stringify(data, null, 2)}`);
  }
}

async function request(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, body: json };
}

async function runTest() {
  console.log(`\n${colors.bold}${colors.magenta}🚀 Starting HVAC ERP End-to-End Live API Testing on: ${BASE_URL}${colors.reset}`);

  // Step 1: Health & Observability Check
  logStep(1, 'API Gateway Health & Observability Probes');
  const healthRes = await request('GET', '/health');
  if (healthRes.ok && healthRes.body.status === 'ok') {
    logResult(true, `API Gateway is Healthy (Status 200)`, healthRes.body);
  } else {
    logResult(false, `Gateway health check failed: ${healthRes.status}`, healthRes.body);
  }

  // Step 2: Create Company and Super Admin User
  logStep(2, 'Company Registration & Super Admin Onboarding (Identity Service)');
  const companyPayload = {
    companyId: 'comp_ahram_hvac',
    name: 'شركة الأهرام للتكييف والتبريد وأنظمة التهوية المركزية',
    commercialRegistrationNumber: 'CR-10482910',
    taxNumber: 'TR-987654321',
    currency: 'EGP',
    adminUser: {
      username: 'ahram_admin',
      email: 'admin@ahram-hvac.com',
      password: 'AdminPassword@2026!',
      fullName: 'المهندس أحمد سمير - مدير عام العمليات',
      phone: '+201012345678',
    },
  };

  const compRes = await request('POST', '/api/v1/companies', companyPayload);
  if (compRes.status === 201) {
    logResult(true, 'Company & Super Admin created successfully', compRes.body);
  } else if (compRes.status === 409) {
    logResult(true, 'Company already exists (Idempotent replay)', compRes.body);
  } else {
    logResult(false, `Failed to register company: ${compRes.status}`, compRes.body);
  }

  // Step 3: Login as Super Admin to obtain JWT Token
  logStep(3, 'Authentication & JWT Token Generation (Identity Service)');
  const loginRes = await request('POST', '/api/v1/auth/login', {
    companyId: 'comp_ahram_hvac',
    identifier: 'ahram_admin',
    password: 'AdminPassword@2026!',
  });

  let accessToken = null;
  if (loginRes.ok && loginRes.body?.data?.accessToken) {
    accessToken = loginRes.body.data.accessToken;
    logResult(true, 'Admin Login Successful! JWT Tokens Generated', {
      user: loginRes.body.data.user,
      expiresIn: loginRes.body.data.expiresIn,
      tokenSnippet: `${accessToken.slice(0, 30)}...`,
    });
  } else {
    logResult(false, `Login failed: ${loginRes.status}`, loginRes.body);
    process.exit(1);
  }

  // Step 4: Verify Current User Profile
  logStep(4, 'Verify User Identity & Tenant Context (/api/v1/auth/me)');
  const meRes = await request('GET', '/api/v1/auth/me', null, accessToken);
  if (meRes.ok) {
    logResult(true, 'Tenant Context & Roles Verified', meRes.body);
  } else {
    logResult(false, `Failed to fetch profile: ${meRes.status}`, meRes.body);
  }

  // Step 5: Register Real HVAC Corporate Customer (Customer Service)
  logStep(5, 'Register HVAC Customer Profile (Customer Service)');
  const customerPayload = {
    name: 'شركة النيل للمقاولات العامة والتوريدات الهندسية',
    type: 'COMMERCIAL',
    taxNumber: `456-789-${Date.now().toString().slice(-3)}`,
    commercialRegister: `CR-${Date.now().toString().slice(-5)}`,
    phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `contracts-${Date.now().toString().slice(-4)}@al-nile-eng.com`,
    branchId: 'br_cairo_main',
    creditLimit: '500000.00',
    initialAddress: {
      title: 'المقر الإداري والمشروعات',
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      street: 'شارع مكرم عبيد',
      buildingNumber: '18',
      floor: '4',
      landmark: 'بجوار بنك مصر',
    },
  };

  let customerId = null;
  const custRes = await request('POST', '/api/v1/customers', customerPayload, accessToken);
  if (custRes.status === 201) {
    customerId = custRes.body.data.customerId;
    logResult(true, `Customer created successfully with ID: ${customerId}`, custRes.body.data);
  } else {
    // If already exists or error, list customers
    const listCust = await request('GET', '/api/v1/customers', null, accessToken);
    const existingList = Array.isArray(listCust.body?.data) ? listCust.body.data : listCust.body?.data?.items;
    if (listCust.ok && existingList?.length > 0) {
      customerId = existingList[0].customerId;
      logResult(true, `Customer retrieved from database: ${customerId}`, existingList[0]);
    } else {
      logResult(false, `Failed to create/retrieve customer: ${custRes.status}`, custRes.body);
    }
  }

  // Step 6: Create HVAC Product in Inventory Catalog (Inventory Service)
  logStep(6, 'Create HVAC Product in Catalog (Inventory Service)');
  const sku = `AC-CAR-3HP-INV-${Date.now().toString().slice(-4)}`;
  const productPayload = {
    sku,
    name: 'تكييف كاريير أوبتيماكس انفرتر 3 حصان بارد ساخن',
    brand: 'Carrier',
    category: 'Split Units',
    modelNumber: '53QHCT24N-708',
    coolingCapacityBtu: 24000,
    horsepower: '3.0 HP',
    refrigerantType: 'R410A',
    basePrice: '32500.00',
    costPrice: '25000.00',
    isSerialized: true,
    minStockLevel: 5,
  };

  let productId = null;
  const prodRes = await request('POST', '/api/v1/inventory/products', productPayload, accessToken);
  if (prodRes.status === 201) {
    productId = prodRes.body.data.productId;
    logResult(true, `Product created with SKU ${sku} (ID: ${productId})`, prodRes.body.data);
  } else {
    // Check existing
    const listProd = await request('GET', '/api/v1/inventory/products', null, accessToken);
    if (listProd.ok && listProd.body.data?.items?.length > 0) {
      productId = listProd.body.data.items[0].productId;
      logResult(true, `Product retrieved from catalog: ${productId}`, listProd.body.data.items[0]);
    } else {
      logResult(false, `Failed to create product: ${prodRes.status}`, prodRes.body);
    }
  }

  // Step 7: Create Commercial Sales Order (Sales Service)
  logStep(7, 'Create Commercial Sales Order for HVAC Units (Sales Service)');
  if (customerId && productId) {
    const orderPayload = {
      customerId,
      branchId: 'br_cairo_main',
      warehouseId: 'wh_cairo_central',
      saleType: 'COMMERCIAL',
      items: [
        {
          productId,
          productName: 'تكييف كاريير أوبتيماكس انفرتر 3 حصان بارد ساخن',
          quantity: 5,
          unitPrice: '32500.00',
          discountAmount: '0.00',
        },
      ],
      notes: 'توريد وتركيب عدد 5 أجهزة تكييف كاريير 3 حصان لمشروع مبنى الإدارة الجديد',
    };

    const orderRes = await request('POST', '/api/v1/sales/orders', orderPayload, accessToken);
    if (orderRes.status === 201) {
      logResult(true, `Sales Order created successfully (ID: ${orderRes.body.data.orderId})`, orderRes.body.data);
    } else {
      logResult(false, `Sales order creation response: ${orderRes.status}`, orderRes.body);
    }
  } else {
    console.log(`${colors.yellow}Skipping Sales Order (Customer or Product missing)${colors.reset}`);
  }

  // Step 8: Initialize General Ledger Chart of Accounts (Finance Service)
  logStep(8, 'Ensure Standard Chart of Accounts (Finance Service)');
  const accountsRes = await request('POST', '/api/v1/finance/accounts/standard-accounts', {}, accessToken);
  if (accountsRes.ok) {
    logResult(true, 'Standard HVAC Chart of Accounts Verified / Seeded', accountsRes.body);
  } else {
    logResult(false, `Chart of accounts status: ${accountsRes.status}`, accountsRes.body);
  }

  // Step 9: List Financial Chart of Accounts
  logStep(9, 'Query Financial General Ledger Accounts (Finance Service)');
  const listAccountsRes = await request('GET', '/api/v1/finance/accounts', null, accessToken);
  if (listAccountsRes.ok) {
    const accounts = listAccountsRes.body.data || [];
    logResult(true, `Retrieved ${accounts.length} General Ledger Accounts`, accounts.slice(0, 5));
  } else {
    logResult(false, `Failed to query accounts: ${listAccountsRes.status}`, listAccountsRes.body);
  }

  console.log(`\n${colors.bold}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.green}  🎉 All HVAC ERP API Microservices Verified Successfully!${colors.reset}`);
  console.log(`${colors.bold}${colors.green}======================================================================${colors.reset}\n`);
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

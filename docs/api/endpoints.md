# Exhaustive Microservices API Endpoint Catalog

## 1. Identity & Access Management (`/api/v1/auth`, `/api/v1/users` — Port 4001)

### Public Authentication Endpoints
- **`POST /api/v1/auth/login`**: Authenticates user via email and password using Argon2id.
  - **Request**: `{ "email": "manager@cairo.hvac.com", "password": "SecurePassword123!" }`
  - **Response (`200 OK`)**: `{ "accessToken": "eyJhbG...", "refreshToken": "rt_89af...", "user": { "userId": "usr_01", "email": "...", "roles": ["branch_manager"] } }`
- **`POST /api/v1/auth/refresh`**: Rotates refresh token and issues a new access token.
  - **Request**: `{ "refreshToken": "rt_89af..." }`
  - **Response (`200 OK`)**: `{ "accessToken": "eyJhbG...", "refreshToken": "rt_new..." }`
- **`POST /api/v1/auth/logout`**: Revokes the active refresh token and server session.

### User & Role Management (Protected)
- **`GET /api/v1/users`**: List users within company scope (Permissions: `identity:user:view:company`).
- **`POST /api/v1/users`**: Create a new company user and assign roles and branch scope (Permissions: `identity:user:create:company`).
- **`GET /api/v1/users/:id`**: Retrieve user profile and assigned branch scopes.
- **`PUT /api/v1/users/:id/branches`**: Update user's accessible branch scope (`allowedBranchIds`).

---

## 2. Inventory & Warehouse Management (`/api/v1/inventory` — Port 4002)

### Product Catalog & Stock
- **`GET /api/v1/inventory/products`**: List product catalog with SKU, brand, and category filters.
- **`POST /api/v1/inventory/products`**: Register new product SKU, model, warranty months, and unit dimensions.
- **`GET /api/v1/inventory/balances`**: Query stock balances per product and warehouse (`onHand`, `reserved`, `damaged`, `available`).
- **`GET /api/v1/inventory/movements`**: Immutable historical inventory movement ledger (`PURCHASE_RECEIPT`, `SALE_DELIVERY`, etc.).

### Serial Number Tracking
- **`GET /api/v1/inventory/serials/:serialNumber`**: Query exact lifecycle state of a serialized AC unit (`IN_STOCK`, `RESERVED`, `SOLD`, `INSTALLED`).
- **`POST /api/v1/inventory/serials/track`**: Register serial numbers received from purchase GRN.

### Warehouse Transfers
- **`POST /api/v1/inventory/transfers`**: Create a new warehouse transfer request (`DRAFT` $\to$ `PENDING_APPROVAL`).
- **`POST /api/v1/inventory/transfers/:id/ship`**: Transition approved transfer to `SHIPPED` / `IN_TRANSIT`.
- **`POST /api/v1/inventory/transfers/:id/receive`**: Receive transferred stock at destination warehouse; increments destination On-Hand atomically.

---

## 3. Purchasing & Supplier Operations (`/api/v1/purchasing` — Port 4003)

### Suppliers
- **`GET /api/v1/purchasing/suppliers`**: List registered vendors, tax registration, and payment terms.
- **`POST /api/v1/purchasing/suppliers`**: Create new supplier profile with credit settings.

### Purchase Orders (PO)
- **`GET /api/v1/purchasing/orders`**: List purchase orders with status filtering (`DRAFT`, `APPROVED`, `PARTIALLY_RECEIVED`, `CLOSED`).
- **`POST /api/v1/purchasing/orders`**: Create a purchase order with items, expected delivery date, and agreed supplier prices.
- **`POST /api/v1/purchasing/orders/:id/approve`**: Approve PO (triggers `purchasing.po.created.v1` Outbox event).

### Goods Receipt Notes (GRN) & Vendor Bills
- **`POST /api/v1/purchasing/goods-receipts`**: Record incoming delivery from supplier with item inspection and serial numbers.
- **`POST /api/v1/purchasing/bills`**: Create vendor bill against verified GRN for accounting matching.

---

## 4. Customer Relationship & Contracts (`/api/v1/customers` — Port 4004)

- **`GET /api/v1/customers`**: Search customer directory by name, national ID, commercial registration, or phone number.
- **`POST /api/v1/customers`**: Create a new customer profile with classification (`INDIVIDUAL`, `COMMERCIAL`, `GOVERNMENT`).
- **`GET /api/v1/customers/:id`**: Retrieve customer details, credit profiles, and active branches.
- **`PUT /api/v1/customers/:id/credit-limit`**: Set or adjust commercial credit limit and payment terms.

---

## 5. Sales & Orders (`/api/v1/sales` — Port 4005)

### Quotations & Sales Orders
- **`POST /api/v1/sales/quotations`**: Generate a formal price quotation with product pricing and branch discounts.
- **`POST /api/v1/sales/orders`**: Execute Cash or Commercial Sale (Initiates Cash Sale Saga V2).
  - **Request**:
    ```json
    {
      "customerId": "cust_123",
      "orderType": "CASH",
      "branchId": "br_nasr_city",
      "warehouseId": "wh_01",
      "items": [
        { "productId": "prod_1", "quantity": 1, "unitSalePrice": "15000.00", "serialNumbers": ["SN-882201"] }
      ]
    }
    ```
- **`GET /api/v1/sales/orders/:id`**: Query sales order status, delivery progress, and linked commercial invoice.
- **`POST /api/v1/sales/orders/:id/cancel`**: Cancel unfulfilled sales order and trigger compensating saga stock release.

---

## 6. Installments & Credit Plans (`/api/v1/installments` — Port 4006)

- **`POST /api/v1/installments/contracts`**: Create installment contract with monthly payment amortization schedule.
- **`GET /api/v1/installments/contracts/:id`**: Query contract schedule, paid installments, remaining balance, and overdue dates.
- **`POST /api/v1/installments/contracts/:id/reschedule`**: Re-amortize remaining installment balance over new tenure.
- **`GET /api/v1/installments/overdue`**: Query all overdue installment schedules across company branches.

---

## 7. Finance & Accounting (`/api/v1/finance` — Port 4007)

### General Ledger & Journals
- **`GET /api/v1/finance/chart-of-accounts`**: Retrieve hierarchical Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, Expenses).
- **`POST /api/v1/finance/journals`**: Post balanced manual or automated journal entry (`Total Debit == Total Credit`).
- **`GET /api/v1/finance/journals/:id`**: Retrieve journal entry lines and source transaction references.

### Treasury, Payments & Collections
- **`GET /api/v1/finance/treasuries`**: List branch cash safes and bank accounts with current balances.
- **`POST /api/v1/finance/payments`**: Record incoming or outgoing payment (`CASH`, `BANK_TRANSFER`, `CARD`, `CHEQUE`).
- **`POST /api/v1/finance/payments/allocate`**: Allocate payment across one or multiple customer invoices / installments.
- **`POST /api/v1/finance/daily-closing`**: Execute daily cash safe closing with expected vs. actual reconciliation.
- **`POST /api/v1/finance/periods/:id/lock`**: Lock accounting period to prevent retroactive tampering.

---

## 8. Technician & Field Operations (`/api/v1/technicians` — Port 4008)

- **`GET /api/v1/technicians`**: List field technicians, active roster, skills, and current branch assignment.
- **`GET /api/v1/technicians/:id/custody`**: Query technician's cash custody and vehicle van stock.
- **`POST /api/v1/technicians/:id/settlements`**: Process technician cash clearance and commission settlement.

---

## 9. Service Operations & Work Orders (`/api/v1/service-ops` — Port 4009)

- **`POST /api/v1/service-ops/tickets`**: Register customer service complaint or maintenance request.
- **`POST /api/v1/service-ops/work-orders`**: Dispatch installation or maintenance work order to assigned technician.
- **`POST /api/v1/service-ops/work-orders/:id/complete`**: Complete work order with field checklist, spare parts used, and signature photo.

---

## 10. Approval Engine (`/api/v1/approvals` — Port 4010)

- **`GET /api/v1/approvals/requests`**: List pending approval requests for active manager.
- **`POST /api/v1/approvals/requests/:id/approve`**: Approve pending step (advances multi-tier chain or emits approved event).
- **`POST /api/v1/approvals/requests/:id/reject`**: Reject request with mandatory reason note.

---

## 11. Notification Service (`/api/v1/notifications` — Port 4011)

- **`POST /api/v1/notifications/send`**: Trigger multi-channel alert (`SMS`, `WHATSAPP`, `EMAIL`, `IN_APP`).
- **`GET /api/v1/notifications/my`**: Retrieve user in-app notifications.
- **`PUT /api/v1/notifications/preferences`**: Configure per-channel opt-in/opt-out settings.

---

## 12. Audit & Security Logging (`/api/v1/audit` — Port 4012)

- **`GET /api/v1/audit/logs`**: Query immutable audit trail with actor, action, timestamp, and before/after diffs.
- **`GET /api/v1/audit/security-events`**: Retrieve security events (failed logins, revoked tokens, cross-company access attempts).

---

## 13. Reporting & Analytics (`/api/v1/reports` — Port 4013)

- **`GET /api/v1/reports/sales/summary`**: CQRS sales funnel, revenue, and gross profit by branch and product line.
- **`GET /api/v1/reports/inventory/valuation`**: Total inventory value across warehouses using configured costing (FIFO/Average).
- **`GET /api/v1/reports/finance/pnl`**: Real-time / projected Profit & Loss summary.
- **`GET /api/v1/reports/technicians/performance`**: Technician SLA compliance and first-time fix rates.

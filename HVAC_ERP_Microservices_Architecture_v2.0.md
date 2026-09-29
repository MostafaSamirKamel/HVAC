# HVAC Enterprise Resource Planning (ERP)
## Comprehensive Microservices Architecture Blueprint — Version 2.0

**Status:** Architecture Freeze Candidate  
**Backend:** Node.js + Express.js + TypeScript  
**Database:** MongoDB Replica Set + Mongoose  
**Messaging:** RabbitMQ  
**Cache / Locks / Jobs:** Redis + BullMQ  
**Architecture:** Domain-Oriented Microservices + Event-Driven Architecture + Persistent Orchestrated Sagas + CQRS Read Models  
**Package Management:** pnpm Workspaces + Turborepo  
**Observability:** Pino + OpenTelemetry + Prometheus + Grafana  
**File Storage:** S3-Compatible Object Storage / MinIO  
**Deployment:** Docker / Docker Compose, Kubernetes-ready

---

# 0. Purpose of Version 2.0

This document defines the official Version 2.0 backend architecture for the HVAC Multi-Branch ERP platform.

Version 2.0 supersedes the previous architecture draft and introduces stricter production rules for service ownership, tenant isolation, financial integrity, inventory integrity, event delivery, idempotency, Saga persistence, compensation logic, MongoDB transaction boundaries, RabbitMQ routing, audit safety, reporting consistency, observability, graceful shutdown, disaster recovery, schema migration, and testing.

This is a production ERP architecture, not a CRUD demo.

The backend must prioritize:

1. Financial correctness
2. Inventory correctness
3. Tenant isolation
4. Auditability
5. Idempotency
6. Security
7. Recoverability
8. Observability
9. Scalability
10. Maintainability

---

# 1. Core Architectural Invariants

## 1.1 Microservices Architecture

The platform consists of:

- 13 domain microservices
- 1 API Gateway

Total deployable backend applications: **14 applications**.

The API Gateway is not considered a domain microservice and owns no business database.

## 1.2 Technology Stack

### Runtime
- Node.js
- Express.js
- TypeScript

### Database
- MongoDB
- Mongoose
- MongoDB Replica Set

### Message Broker
- RabbitMQ

### Cache / Locks / Background Jobs
- Redis
- Redlock where appropriate
- BullMQ

### Validation
- Zod

### Authentication
- JWT Access Tokens
- Refresh Token Rotation
- Internal Signed Service Tokens

### Password Hashing
- Argon2id preferred

### Logging
- Pino

### Tracing
- OpenTelemetry

### Metrics
- Prometheus

### Dashboarding
- Grafana

### File Storage
- S3-compatible object storage
- MinIO for local development

### Testing
- Vitest or Jest
- Supertest
- Testcontainers

### Deployment
- Docker
- Docker Compose
- Kubernetes-ready

---

# 2. System Architecture

```text
                         ┌───────────────────────────────┐
                         │ Web / Mobile / Admin Clients  │
                         └───────────────┬───────────────┘
                                         │
                                      HTTPS
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │         API Gateway           │
                         │ :3000                         │
                         │ Auth Verification             │
                         │ Rate Limiting                 │
                         │ Request / Correlation IDs     │
                         │ Routing                       │
                         │ Edge Security                 │
                         └───────────────┬───────────────┘
                                         │
                               Internal REST Network
                                         │
        ┌────────────────────────────────┼─────────────────────────────────┐
        │                                │                                 │
        ▼                                ▼                                 ▼

┌────────────────────┐        ┌────────────────────┐            ┌────────────────────┐
│ Core Operations    │        │ Financial Domain   │            │ Field Operations   │
├────────────────────┤        ├────────────────────┤            ├────────────────────┤
│ Identity           │        │ Finance            │            │ Technician         │
│ Inventory          │        │ Installments       │            │ Service Operations │
│ Purchasing         │        └────────────────────┘            └────────────────────┘
│ Customer           │
│ Sales              │
└────────────────────┘

        ┌──────────────────────────────────────────────────────────────────┐
        │                      Cross-Cutting Services                      │
        ├──────────────────────────────────────────────────────────────────┤
        │ Approval │ Notification │ Audit │ Reporting                      │
        └──────────────────────────────────────────────────────────────────┘

                                         │
                                         ▼

                    ═════════════════════════════════════
                         RabbitMQ Event Mesh
                    Exchange: hvac.events.topic
                    DLX:      hvac.dlx
                    ═════════════════════════════════════

                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼

             MongoDB Replica Set       Redis            Object Storage
                   rs0              Cache/Locks/Jobs      S3 / MinIO
```

---

# 3. Services and Responsibilities

## 3.1 API Gateway — `:3000`

Responsibilities:
- public API entry point
- request routing
- authentication validation
- rate limiting
- request IDs
- correlation IDs
- edge security
- CORS
- security headers
- API versioning
- internal identity propagation
- response normalization
- readiness / liveness

The Gateway owns no business database.

## 3.2 Identity & Access Service — `:4001`

Owns:
- companies
- branches
- users
- employees
- roles
- permissions
- sessions
- refresh tokens
- password reset tokens
- user branch scope

Responsibilities:
- login
- refresh token rotation
- logout
- revoke session
- password change / reset
- user disabling
- RBAC
- tenant context
- branch authorization scope

## 3.3 Catalog & Inventory Service — `:4002`

Owns:
- products
- brands
- categories
- warehouses
- stock locations
- serial numbers
- stock balances
- stock movements
- stock reservations
- warehouse transfers
- inventory adjustments

Responsibilities:
- catalog
- serial lifecycle
- stock availability
- reservations
- movements
- warehouse transfers
- stock count
- inventory adjustments

## 3.4 Purchasing Service — `:4003`

Owns:
- suppliers
- purchase requests
- RFQs
- purchase orders
- goods receipts
- vendor invoice documents
- purchase returns

Responsibilities:
- purchasing workflow
- supplier transactions
- goods receiving
- GRN
- purchase returns

Finance owns accounting posting and supplier ledger effects.

## 3.5 Customer Service — `:4004`

Owns:
- customers
- addresses
- contact methods
- customer classification
- credit settings
- payment terms
- commercial profiles

## 3.6 Sales Service — `:4005`

Owns:
- price lists
- quotations
- sales orders
- delivery orders
- commercial invoice documents
- sales returns
- sales Saga state

Responsibilities:
- CASH sales
- INSTALLMENT sales
- COMMERCIAL sales
- sale pricing
- reservation commands
- delivery workflow
- invoice document generation
- Saga orchestration

Finance owns accounting posting generated from invoices.

## 3.7 Installment Service — `:4006`

Owns:
- installment contracts
- installment schedules
- rescheduling history
- overdue records

Responsibilities:
- contract generation
- payment schedules
- due dates
- overdue detection
- rescheduling
- early settlement
- late-fee framework

## 3.8 Finance & Accounting Service — `:4007`

Owns:
- chart of accounts
- journal entries
- journal lines
- financial entries
- treasuries
- treasury ledger entries
- bank accounts
- bank transactions
- payments
- payment allocations
- expenses
- expense categories
- cash transfers
- customer ledger entries
- supplier ledger entries
- daily closings
- financial periods
- financial adjustments
- reversal records

Responsibilities:
- double-entry accounting
- cash and bank movement
- journal posting
- payment allocation
- receivables
- payables
- treasury state
- P&L
- gross profit
- net profit
- cash flow
- daily closing
- period locking
- reversal processing

## 3.9 Technician Service — `:4008`

Owns:
- technicians
- technician assignments
- skill matrix
- cash custody
- stock custody
- technician expenses
- settlements

## 3.10 Service Operations Service — `:4009`

Owns:
- complaints
- service tickets
- work orders
- installation orders
- maintenance visits
- warranties
- spare-part usage
- field attachment metadata

## 3.11 Approval Service — `:4010`

Owns:
- approval rules
- approval requests
- approval steps
- approval history

Approval Service never directly mutates another service's database.
It emits approval decision events and the owning service performs the state transition.

## 3.12 Notification Service — `:4011`

Owns:
- notification templates
- notifications
- user preferences
- delivery logs

Channels:
- In-App
- Email
- SMS
- WhatsApp

## 3.13 Audit Service — `:4012`

Owns:
- audit logs
- security events
- data change history

All audit collections are append-only.

## 3.14 Reporting Service — `:4013`

Owns:
- CQRS projections
- daily summaries
- branch summaries
- finance projections
- inventory projections
- receivables aging
- payables aging
- technician performance projections

---

# 4. Database-Per-Service Strategy

Each service owns exactly one logical MongoDB database.

```text
hvac_identity
hvac_inventory
hvac_purchasing
hvac_customers
hvac_sales
hvac_installments
hvac_finance
hvac_technicians
hvac_service_operations
hvac_approvals
hvac_notifications
hvac_audit
hvac_reporting
```

Rules:
- no cross-service Mongoose refs
- no direct cross-database queries
- no shared business collections
- foreign aggregate references use primitive string IDs
- service data is accessed only through REST, domain events, or reporting projections

---

# 5. Collections Per Service

## `hvac_identity`

```text
companies
branches
employees
users
roles
permissions
user_roles
user_branch_scopes
sessions
refresh_tokens
password_reset_tokens
outbox_events
processed_events
idempotency_records
```

## `hvac_inventory`

```text
products
brands
categories
warehouses
stock_locations
serial_numbers
stock_balances
stock_movements
stock_reservations
warehouse_transfers
inventory_adjustments
number_counters
outbox_events
processed_events
idempotency_records
```

## `hvac_purchasing`

```text
suppliers
purchase_requests
rfqs
purchase_orders
goods_receipts
vendor_invoices
purchase_returns
number_counters
outbox_events
processed_events
idempotency_records
```

## `hvac_customers`

```text
customers
customer_addresses
customer_credit_profiles
outbox_events
processed_events
```

## `hvac_sales`

```text
price_lists
quotations
sales_orders
deliveries
sales_invoices
sales_returns
saga_instances
number_counters
outbox_events
processed_events
idempotency_records
```

## `hvac_installments`

```text
installment_contracts
installment_schedules
installment_reschedules
overdue_records
saga_instances
outbox_events
processed_events
idempotency_records
```

## `hvac_finance`

```text
chart_of_accounts
journal_entries
journal_lines
financial_entries
treasuries
treasury_ledger_entries
treasury_balances
bank_accounts
bank_transactions
payments
payment_allocations
expenses
expense_categories
cash_transfers
customer_ledger_entries
supplier_ledger_entries
daily_closings
financial_periods
financial_adjustments
reversal_records
saga_instances
number_counters
outbox_events
processed_events
idempotency_records
```

## `hvac_technicians`

```text
technicians
technician_assignments
cash_custody_ledgers
stock_custody_ledgers
technician_expenses
settlements
outbox_events
processed_events
idempotency_records
```

## `hvac_service_operations`

```text
complaints
service_tickets
work_orders
installations
maintenance_records
warranties
spare_part_usages
outbox_events
processed_events
idempotency_records
```

## `hvac_approvals`

```text
approval_rules
approval_requests
approval_steps
approval_history
outbox_events
processed_events
idempotency_records
```

## `hvac_notifications`

```text
notification_templates
notifications
user_preferences
delivery_logs
outbox_events
processed_events
```

## `hvac_audit`

```text
audit_logs
security_events
data_change_histories
processed_events
```

## `hvac_reporting`

```text
daily_sales_summaries
daily_financial_summaries
branch_performance_projections
inventory_valuation_summaries
receivables_aging_summaries
payables_aging_summaries
technician_productivity_summaries
projection_checkpoints
processed_events
```

---

# 6. Multi-Tenant and Multi-Branch Isolation

Every business-owned document contains:

```text
companyId
```

Where applicable:

```text
branchId
warehouseId
treasuryId
```

Every query is company-scoped before branch-scoped.

```ts
function buildAuthorizedScope(auth: AuthContext) {
  const tenant = { companyId: auth.companyId };

  if (auth.isPlatformSuperAdmin && auth.crossCompanyAccess) return {};
  if (auth.scopeType === 'company') return tenant;

  if (auth.scopeType === 'branch') {
    return { ...tenant, branchId: auth.branchId };
  }

  if (auth.scopeType === 'selected_branches') {
    return {
      ...tenant,
      branchId: { $in: auth.allowedBranchIds }
    };
  }

  return {
    ...tenant,
    createdBy: auth.userId
  };
}
```

`companyId` is never trusted from client input.

---

# 7. Authentication

## Access Token

- JWT
- 15-minute lifetime
- signed securely
- minimal claims

## Refresh Token

- 7-day lifetime
- rotation required
- server session required
- revocation supported
- hashed at rest
- device metadata tracked

## Passwords

Use Argon2id.

---

# 8. Internal Service Security

Gateway-to-service calls use a short-lived signed internal JWT.

Example claims:

```json
{
  "sub": "user-id",
  "companyId": "company-id",
  "branchId": "branch-id",
  "allowedBranchIds": [],
  "roles": ["branch_manager"],
  "permissionVersion": 17,
  "correlationId": "uuid",
  "iat": 0,
  "exp": 0
}
```

Every service verifies this token independently.

---

# 9. RBAC

Permission model:

```text
resource : action : scope
```

Actions:

```text
view
create
edit
approve
cancel
export
print
```

Scopes:

```text
own
branch
selected_branches
company
```

Examples:

```text
sales:create:branch
inventory:view:selected_branches
finance:view:company
discount:approve:branch
```

---

# 10. MongoDB Deployment

Production:

```text
3-node Replica Set
Replica Set Name: rs0
```

Critical writes:

```js
writeConcern: { w: "majority", j: true }
readConcern: { level: "majority" }
```

Dashboard/read-model queries may use `secondaryPreferred` only when eventual consistency is acceptable.

---

# 11. MongoDB Schema Evolution

MongoDB does not remove the need for migrations.

Use:

```text
schemaVersion
scripts/database/migrations/
scripts/database/backfills/
scripts/database/indexes/
```

Each schema change defines:
- migration
- backfill
- index changes
- compatibility window
- rollback / forward-fix strategy

---

# 12. Money Handling

Never use JavaScript floating-point math for financial calculations.

Use:

```text
MongoDB Decimal128
Decimal.js
```

Backend recalculates:
- subtotal
- discount
- tax
- total
- paid
- remaining
- COGS
- Gross Profit
- Net Profit

Frontend totals are never authoritative.

---

# 13. Snapshot Strategy

Transactional documents preserve historical master-data snapshots.

Example:

```ts
interface SalesLineSnapshot {
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  brandNameSnapshot: string;
  modelSnapshot?: string;
  unitCostSnapshot: mongoose.Types.Decimal128;
  unitSalePriceSnapshot: mongoose.Types.Decimal128;
  discountSnapshot: mongoose.Types.Decimal128;
  taxSnapshot: mongoose.Types.Decimal128;
  quantity: number;
  serialNumbers: string[];
}
```

---

# 14. Inventory Consistency Model

## StockMovement

Immutable inventory ledger.

Movement types:

```text
PURCHASE_RECEIPT
SALE_DELIVERY
TRANSFER_OUT
TRANSFER_IN
CUSTOMER_RETURN
SUPPLIER_RETURN
ADJUSTMENT_IN
ADJUSTMENT_OUT
TECHNICIAN_ISSUE
TECHNICIAN_RETURN
DAMAGED
WRITE_OFF
```

## StockBalance

Current operational projection.

```text
onHand
reserved
damaged
inTransit
available
```

Rule:

```text
StockMovement = historical inventory truth
StockBalance  = current operational state
```

Movement creation and balance mutation happen atomically in the same Inventory Service transaction.

---

# 15. Availability Formula

```text
Available = On Hand - Reserved - Damaged
```

If in-transit stock has already left source On Hand, do not subtract it again.

Negative available stock is forbidden unless explicitly configured by business policy.

---

# 16. Serial Number State Machine

States:

```text
IN_STOCK
RESERVED
IN_TRANSIT
SOLD
INSTALLED
RETURNED
DAMAGED
SUPPLIER_RETURN
```

Main path:

```text
Goods Receipt → IN_STOCK → RESERVED → SOLD → INSTALLED
```

Alternative transitions:

```text
IN_STOCK → IN_TRANSIT → IN_STOCK
SOLD → RETURNED
IN_STOCK → DAMAGED
RETURNED → SUPPLIER_RETURN
```

All transitions are validated.

Protection against duplicate sale relies on:
- Mongo transaction
- conditional update
- unique constraints
- idempotency
- optional Redis lock

Redis is not the primary correctness guarantee.

---

# 17. Stock Reservation

Reservation fields:

```text
reservationId
companyId
branchId
warehouseId
orderId
productId
quantity
serialIds
status
expiresAt
createdAt
createdBy
```

Statuses:

```text
ACTIVE
CONSUMED
RELEASED
EXPIRED
```

A serialized unit cannot have multiple active reservations.

---

# 18. Financial Consistency Model

## JournalEntry
Accounting source of truth.

Mandatory invariant:

```text
Total Debit = Total Credit
```

## TreasuryLedgerEntry
Immutable treasury movement history.

## FinancialEntry
Operational financial movement / reporting bridge.

## TreasuryBalance
Current projection.

Rule:

```text
JournalEntry    = accounting truth
TreasuryLedger  = cash movement truth
TreasuryBalance = current operational projection
FinancialEntry  = operational reporting projection
```

No public API directly edits treasury balance.

---

# 19. Chart of Accounts

Recommended root structure:

```text
1000 Assets
2000 Liabilities
3000 Equity
4000 Revenue
5000 Cost of Goods Sold
6000 Operating Expenses
```

Sub-accounts are extensible per company.

---

# 20. Revenue Recognition

Revenue is recognized on invoice posting / configured delivery accounting point.

Customer collection does not create new revenue.

Example:

```text
Invoice: Revenue +50,000 / Accounts Receivable +50,000
Payment: Cash +50,000 / Accounts Receivable -50,000
```

---

# 21. Costing Strategy

Use a strategy interface:

```ts
interface InventoryCostingStrategy {
  calculateCost(input: CostingInput): Promise<Decimal>;
}
```

Supported:

```text
FIFO
WEIGHTED_AVERAGE
```

Costing method is configurable per company.

---

# 22. Payment Engine

Finance Service owns all payments.

Types:

```text
CUSTOMER_PAYMENT
INSTALLMENT_PAYMENT
SUPPLIER_PAYMENT
REFUND
OTHER
```

Methods:

```text
CASH
BANK_TRANSFER
CARD
WALLET
CHEQUE
```

---

# 23. Payment Allocation

Payments may be allocated across:
- one invoice
- many invoices
- one installment
- many installments
- supplier invoices
- credit balance

Collections:

```text
payments
payment_allocations
```

Allocations are idempotent and auditable.

---

# 24. Domain Event Contract

```ts
interface DomainEvent<T> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  companyId: string;
  branchId?: string;
  actor: {
    userId: string;
    roles?: string[];
  };
  payload: T;
}
```

Routing key convention:

```text
{domain}.{entity}.{action}.v{version}
```

---

# 25. Event Catalog

## Inventory

```text
inventory.stock.reserved.v1
inventory.stock.released.v1
inventory.stock.deducted.v1
inventory.transfer.shipped.v1
inventory.transfer.received.v1
inventory.adjustment.posted.v1
```

## Sales

```text
sales.order.created.v1
sales.order.confirmed.v1
sales.order.cancelled.v1
sales.delivery.completed.v1
sales.invoice.created.v1
sales.sale.completed.v1
sales.return.created.v1
```

## Purchasing

```text
purchasing.po.created.v1
purchasing.goods.received.v1
purchasing.bill.created.v1
purchasing.return.completed.v1
```

## Finance

```text
finance.invoice.posted.v1
finance.payment.received.v1
finance.payment.reversed.v1
finance.expense.created.v1
finance.transfer.completed.v1
finance.refund.completed.v1
finance.daily.closed.v1
finance.period.reopened.v1
```

## Installments

```text
installments.contract.created.v1
installments.payment.applied.v1
installments.installment.due.v1
installments.installment.overdue.v1
installments.contract.rescheduled.v1
```

## Technician

```text
technician.assignment.created.v1
technician.cash.collected.v1
technician.expense.created.v1
technician.settlement.done.v1
```

## Service Operations

```text
service.ticket.created.v1
service.workorder.assigned.v1
service.workorder.completed.v1
service.warranty.created.v1
```

## Approvals

```text
approval.request.created.v1
approval.request.approved.v1
approval.request.rejected.v1
```

---

# 26. RabbitMQ Topology

Main exchange:

```text
hvac.events.topic
```

Type:

```text
topic
```

Dead Letter Exchange:

```text
hvac.dlx
```

Dead Letter Queue:

```text
q.dead_letter
```

Recommended bindings:

```text
q.inventory        inventory.#
q.sales            sales.#
q.finance          finance.#
q.installments     installments.#
q.technicians      technician.#
q.service-ops      service.#
q.approvals        approval.#
q.audit            #
q.reporting        #
```

Notification bindings should be explicit for the event families that trigger notifications.

Messages are persistent and publisher confirms are mandatory.

Retry topology:

```text
Main Queue
→ Retry Queue / delayed retry
→ Main Queue
→ DLQ after maximum attempts
```

---

# 27. Transactional Outbox

Inside one MongoDB transaction:

```text
1. mutate aggregate
2. insert outbox event
3. commit
```

Outbox statuses:

```text
PENDING
PROCESSING
PUBLISHED
FAILED
```

Outbox publisher:

```text
fetch pending
→ acquire lease
→ publish RabbitMQ
→ wait publisher confirm
→ mark published
```

---

# 28. Inbox / Idempotent Consumers

Every important consumer stores processed events.

Unique key:

```text
eventId + consumerName
```

Critical financial and inventory events must not rely on a short 30-day retention window.

Recommended:
- permanent or very long retention for money / inventory events
- shorter retention only for low-risk notification-type consumers

---

# 29. API Idempotency

Critical HTTP operations require `Idempotency-Key`.

Applicable to:
- payments
- refunds
- sales completion
- warehouse receive
- goods receipt
- cash transfer
- installment payment
- technician settlement

Store:

```text
idempotencyKey
companyId
userId
route
requestHash
resourceId
responseStatus
responseBody
createdAt
```

---

# 30. Saga Architecture

Cross-service workflows use persistent orchestrated Sagas.

Collection:

```text
saga_instances
```

Fields:

```text
sagaId
sagaType
companyId
aggregateId
status
currentStep
completedSteps
failedStep
retryCount
correlationId
context
startedAt
updatedAt
completedAt
```

Statuses:

```text
PENDING
RUNNING
COMPENSATING
COMPLETED
FAILED
MANUAL_REVIEW
```

Saga processing must survive service restart.

---

# 31. Cash Sale Saga V2

```text
1. Sales: Create Pending Order
2. Inventory: Reserve Stock / Serials
3. Sales: Create Draft Invoice Document
4. Finance: Collect Payment
5. Inventory: Confirm Delivery + Deduct Stock
6. Finance: Post Accounting Invoice
7. Sales: Complete Order
```

Compensation:

| Failing Step | Compensation |
|---|---|
| Reserve fails | Cancel order |
| Draft invoice fails | Release reservation + cancel order |
| Payment fails | Cancel invoice + release reservation + cancel order |
| Delivery/stock deduction fails after payment | Reverse payment + release reservation + cancel invoice + cancel order |
| Accounting posting fails after deduction | Reverse stock movement + restore serial state + reverse payment + cancel invoice + cancel order |

Every compensation command is idempotent.

---

# 32. Installment Sale Saga V2

```text
1. Customer: Verify active profile and credit
2. Sales: Create Pending Installment Order
3. Inventory: Reserve Stock / Serials
4. Installments: Create Contract + Schedule
5. Finance: Collect Down Payment if applicable
6. Sales: Create Draft Invoice
7. Inventory: Deduct Stock / Mark Serials SOLD
8. Finance: Post Invoice + Receivable
9. Sales: Complete Order
```

Compensation reverses only successfully completed steps.

---

# 33. Warehouse Transfer Workflow

```text
DRAFT
↓
PENDING_APPROVAL
↓
APPROVED
↓
RESERVED
↓
SHIPPED
↓
IN_TRANSIT
↓
RECEIVED
↓
COMPLETED
```

Also:

```text
REJECTED
CANCELLED
```

Rules:
- no shipment before approval
- no receive twice
- no receive after cancellation
- stock cannot exceed available quantity
- serial states must follow transfer state
- internal transfer does not change company total inventory

---

# 34. Approval Architecture

Approval Service owns only approval workflow state.

Example:

```text
Inventory creates Transfer
→ Approval Service creates ApprovalRequest
→ Manager approves
→ approval.request.approved.v1
→ Inventory consumes event
→ Inventory transitions Transfer to APPROVED
```

Approval Service never writes to Inventory database.

---

# 35. Audit Strategy

Audit is event-driven.

Mongoose hooks may assist with diff generation, but must not write directly into the Audit Service database.

Audit payload:

```text
entityName
entityId
action
actor
before
after
correlationId
requestId
ipAddress
userAgent
timestamp
```

Sensitive fields are masked.

Audit logs are append-only.

---

# 36. Reversal Strategy

Posted financial and inventory records are never hard deleted.

Financial correction:

```text
Original Journal Entry
→ Reversal Journal Entry
```

Inventory correction:

```text
Original Stock Movement
→ Reverse Stock Movement
```

Link fields:

```text
originalTransactionId
reversalTransactionId
reversalReason
reversedBy
reversedAt
```

---

# 37. Reporting / CQRS Strategy

Reporting Service consumes domain events and maintains read-optimized projections.

Collections:

```text
daily_sales_summaries
daily_financial_summaries
branch_performance_projections
inventory_valuation_summaries
receivables_aging_summaries
payables_aging_summaries
technician_productivity_summaries
```

Operational databases are not used for heavy dashboard aggregation.

---

# 38. Reporting Consistency Metadata

Dashboard/report projection responses should include:

```json
{
  "dataAsOf": "2026-09-27T10:00:00Z",
  "projectionLagMs": 350
}
```

Real-time financial statements may query Finance Service directly.

---

# 39. API Gateway Routes

```text
/api/v1/auth            → Identity
/api/v1/identity        → Identity
/api/v1/inventory       → Inventory
/api/v1/purchasing      → Purchasing
/api/v1/customers       → Customer
/api/v1/sales           → Sales
/api/v1/installments    → Installments
/api/v1/finance         → Finance
/api/v1/technicians     → Technician
/api/v1/service-ops     → Service Operations
/api/v1/approvals       → Approval
/api/v1/notifications   → Notification
/api/v1/audit           → Audit
/api/v1/reports         → Reporting
```

---

# 40. API Response Standard

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient available stock.",
    "details": {}
  },
  "requestId": "uuid"
}
```

---

# 41. Error Taxonomy

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
FORBIDDEN
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
INSUFFICIENT_STOCK
SERIAL_UNAVAILABLE
SERIAL_ALREADY_SOLD
PAYMENT_ALREADY_PROCESSED
PERIOD_LOCKED
APPROVAL_REQUIRED
CREDIT_LIMIT_EXCEEDED
TRANSFER_ALREADY_RECEIVED
IDEMPOTENCY_CONFLICT
SAGA_FAILED
```

---

# 42. Redis Strategy

Redis is used for:
- rate limiting
- session support
- cache
- BullMQ
- temporary Saga coordination
- distributed locks
- branch configuration cache

Redis is never the sole source of truth for money, stock, or durable workflow state.

---

# 43. Distributed Locking

Examples:

```text
lock:serial:{companyId}:{serialNumber}
lock:stock:{companyId}:{warehouseId}:{productId}
lock:treasury:{companyId}:{treasuryId}
lock:closing:{companyId}:{branchId}:{date}
```

Locks supplement, but do not replace:
- Mongo transactions
- unique indexes
- conditional writes
- idempotency
- optimistic concurrency

---

# 44. Optimistic Concurrency

Important aggregates include a version field and use optimistic concurrency where appropriate.

Applicable to:
- SalesOrder
- PurchaseOrder
- WarehouseTransfer
- InstallmentContract
- DailyClosing
- ApprovalRequest

---

# 45. Tenant-Aware Index Strategy

Examples:

```js
{ companyId: 1, serialNumber: 1 } // unique
{ companyId: 1, warehouseId: 1, productId: 1 } // unique
{ companyId: 1, orderNumber: 1 } // unique
{ companyId: 1, invoiceNumber: 1 } // unique
{ companyId: 1, entryNumber: 1 } // unique
{ companyId: 1, contractId: 1, installmentNumber: 1 } // unique
{ companyId: 1, dueDate: 1, status: 1 }
```

Unique business identifiers should not accidentally collide across tenants.

---

# 46. Document Numbering

Never use `MAX(number) + 1`.

Use atomic counters.

Examples:

```text
SO-2026-000001
INV-2026-000001
PO-2026-000001
GRN-2026-000001
RCPT-2026-000001
TRF-2026-000001
WO-2026-000001
```

Counter scope:

```text
companyId + documentType + year + optional branchId
```

---

# 47. Search Strategy

Global search supports:
- customer
- phone
- supplier
- invoice
- serial
- product
- work order
- installment
- receipt

Use normalized fields and indexes.
Avoid broad unindexed regex scans.
MongoDB Atlas Search may be introduced later.

---

# 48. File Storage

Actual files live in S3-compatible storage.
MongoDB stores metadata only.

Use for:
- invoices
- receipts
- expense attachments
- work order photos
- warranty files
- approval attachments
- return photos

Validate:
- MIME type
- extension
- file size
- authorization

---

# 49. Background Jobs

BullMQ jobs:

```text
detect-overdue-installments
send-due-reminders
supplier-due-reminders
low-stock-detection
notification-dispatch
report-export
projection-rebuild
cleanup-expired-reservations
outbox-publisher
```

Every job is idempotent.

---

# 50. Service Communication Rules

## REST
Use for:
- immediate queries
- validations
- Saga commands requiring immediate response

## RabbitMQ
Use for:
- domain events
- side effects
- projections
- notifications
- audit
- eventual consistency

Do not force all state-changing commands through RabbitMQ.
The owning service may handle a synchronous command and then emit events through Outbox.

---

# 51. Observability

Every request/event carries:

```text
requestId
correlationId
traceId
```

Use:
- Pino
- AsyncLocalStorage
- OpenTelemetry
- Prometheus
- Grafana

---

# 52. Metrics

Every service exposes `/metrics`.

Recommended metrics:
- HTTP requests
- latency
- error rate
- Mongo pool use
- RabbitMQ queue depth
- publish failures
- consumer retries
- DLQ count
- Outbox backlog
- Saga failures
- compensation executions
- Redis latency
- job failures

---

# 53. Health Endpoints

Every service exposes:

```text
/health/live
/health/ready
/metrics
```

Readiness checks service-required dependencies.

---

# 54. Graceful Shutdown

On SIGTERM / SIGINT:

```text
1. mark readiness false
2. stop accepting new HTTP traffic
3. stop RabbitMQ consumers
4. stop BullMQ workers
5. finish in-flight requests
6. finish active transactions
7. close RabbitMQ
8. close Redis
9. close MongoDB
10. flush logs/traces
11. exit
```

---

# 55. Security Requirements

Mandatory:
- HTTPS
- Helmet
- strict CORS
- request size limits
- rate limiting
- Zod validation
- Argon2id
- refresh token rotation
- token revocation
- internal service authentication
- backend authorization
- company scope validation
- branch scope validation
- secure file upload
- secret masking
- audit logging
- NoSQL injection defense
- query-field whitelisting

---

# 56. Secrets Management

Never commit secrets.

Use:
- `.env` for local development
- secret manager / Kubernetes secrets in production

Never log:
- passwords
- JWTs
- refresh tokens
- API keys
- DB credentials
- broker credentials

---

# 57. Backup and Disaster Recovery

MongoDB:
- scheduled backups
- PITR where available
- encrypted retention
- offsite copy

Object Storage:
- lifecycle policies
- replication if supported

RabbitMQ:
- topology as code
- definitions export

Mandatory:

```text
Periodic Restore Test
```

Backup is not considered valid without restore verification.

---

# 58. Testing Strategy

## Unit Tests
- money math
- costing
- domain rules
- state machines
- RBAC
- branch scope

## Integration Tests
Use real MongoDB Replica Set plus RabbitMQ/Redis containers.

Test:
- transactions
- Outbox
- Inbox
- Saga persistence
- RabbitMQ
- Redis locks

## Contract Tests
- REST contracts
- event contracts

## Concurrency Tests
- same serial sold twice
- last stock concurrently reserved
- duplicate payment
- duplicate warehouse receive
- duplicate refund
- duplicate daily closing

## E2E Tests
Full business workflows.

---

# 59. Critical Acceptance Tests

1. Same serial cannot sell twice.
2. Stock cannot become negative.
3. Cross-company access is blocked.
4. Unauthorized branch access is blocked.
5. Duplicate event does not duplicate ledger impact.
6. Duplicate payment request does not duplicate money movement.
7. Internal transfer does not create revenue or expense.
8. Customer payment does not duplicate revenue.
9. Reversal restores the accounting effect without deleting history.
10. Closed period blocks unauthorized modification.
11. Warehouse transfer cannot be received twice.
12. Partial installment payment works.
13. Payment allocation works across multiple targets.
14. Supplier credit works.
15. Daily closing calculates expected/actual/difference correctly.
16. Saga resumes after service restart.
17. Compensation is idempotent.
18. Outbox eventually publishes after transient broker failure.
19. Reporting projections can rebuild safely.
20. Audit history is immutable.

---

# 60. Monorepo Structure

```text
hvac-erp-backend/
│
├── apps/
│   ├── api-gateway/
│   ├── identity-service/
│   ├── inventory-service/
│   ├── purchasing-service/
│   ├── customer-service/
│   ├── sales-service/
│   ├── installment-service/
│   ├── finance-service/
│   ├── technician-service/
│   ├── service-operations-service/
│   ├── approval-service/
│   ├── notification-service/
│   ├── audit-service/
│   └── reporting-service/
│
├── packages/
│   ├── event-contracts/
│   ├── api-contracts/
│   ├── config/
│   ├── logger/
│   ├── errors/
│   ├── auth-context/
│   ├── observability/
│   ├── money/
│   ├── testing/
│   ├── eslint-config/
│   └── tsconfig/
│
├── infrastructure/
│   ├── mongodb/
│   ├── rabbitmq/
│   ├── redis/
│   ├── minio/
│   ├── nginx/
│   ├── prometheus/
│   ├── grafana/
│   ├── otel/
│   └── kubernetes/
│
├── scripts/
│   ├── migrations/
│   ├── backfills/
│   ├── indexes/
│   ├── seeds/
│   ├── replay/
│   └── maintenance/
│
├── docs/
│   ├── architecture/
│   ├── events/
│   ├── sagas/
│   ├── database/
│   ├── finance/
│   ├── security/
│   └── api/
│
├── tests/
│   ├── contract/
│   ├── integration/
│   ├── concurrency/
│   ├── performance/
│   └── e2e/
│
├── docker-compose.dev.yml
├── docker-compose.test.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

---

# 61. Standard Service Structure

```text
service-name/
│
├── src/
│   ├── config/
│   ├── modules/
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   └── use-cases/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── services/
│   │   ├── policies/
│   │   ├── events/
│   │   └── errors/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── messaging/
│   │   │   ├── outbox/
│   │   │   └── inbox/
│   │   ├── cache/
│   │   ├── locks/
│   │   ├── clients/
│   │   └── telemetry/
│   ├── middleware/
│   ├── jobs/
│   ├── sagas/
│   ├── common/
│   ├── app.ts
│   └── server.ts
│
├── tests/
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

---

# 62. Shared Package Rules

Allowed:

```text
pure contracts
DTOs
event types
error classes
money value objects
logger
configuration helpers
auth context
telemetry
testing utilities
```

Forbidden:

```text
Mongoose models
service database connections
service repositories
service-specific domain logic
business workflows
service-specific policies
```

---

# 63. Phase 0 — Foundation

Build first:
- pnpm workspace
- Turborepo
- TypeScript
- ESLint
- Prettier
- Vitest
- Docker
- Mongo Replica Set
- RabbitMQ
- Redis
- MinIO
- shared packages
- logging
- tracing
- metrics
- health endpoints

Phase 0 verification:

```text
Mongo Replica Set transaction test
RabbitMQ publisher-confirm test
Outbox → RabbitMQ integration test
Inbox duplicate-delivery test
Redis lock test
Trace propagation test
Graceful shutdown test
Shared package build test
Docker Compose full-start test
```

No business module implementation starts before these pass.

---

# 64. Implementation Roadmap

## Phase 1 — Identity & Access
- companies
- branches
- users
- employees
- roles
- permissions
- sessions
- authentication
- refresh token rotation
- RBAC
- tenant scope
- branch scope
- audit events

## Phase 2 — Catalog & Inventory
- products
- brands
- categories
- warehouses
- serials
- balances
- movements
- reservations
- transfers
- adjustments

## Phase 3 — Purchasing
- suppliers
- purchase requests
- RFQs
- POs
- goods receipts
- vendor invoice documents
- purchase returns
- Inventory integration
- Finance integration

## Phase 4 — Customer & Sales
- customers
- credit profiles
- quotations
- sales orders
- pricing
- deliveries
- invoices
- Cash Sale Saga
- Commercial Sale Saga

## Phase 5 — Finance & Accounting
- Chart of Accounts
- Journals
- Treasury
- Banks
- Payments
- Allocations
- Expenses
- Receivables
- Payables
- Gross Profit
- Net Profit
- P&L
- Cash Flow
- Closing
- Period Lock
- Reversal

## Phase 6 — Installments
- contracts
- schedules
- partial payments
- overdue processing
- rescheduling
- installment Saga
- reminders

## Phase 7 — Field Operations
- technicians
- assignments
- complaints
- tickets
- work orders
- installations
- maintenance
- warranty
- spare parts
- custody
- settlement

## Phase 8 — Governance & Communication
- approval engine
- notifications
- returns
- refunds
- advanced audit

## Phase 9 — Reporting
- CQRS projections
- dashboards
- financial reports
- inventory reports
- branch performance
- technician performance
- Excel / PDF exports
- projection rebuild tooling

---

# 65. Configurable Business Rules

Do not permanently hard-code:

```text
FIFO vs Weighted Average
Tax / VAT
Warranty start rule
Commercial credit policy
Installment late fees
Discount approval thresholds
Refund limits
Cash transfer approval limits
Stock transfer approval limits
Accounting period reopening policy
Payroll scope
Cheques
Bank reconciliation
Owner capital
Depreciation
Fixed assets
Exact accounting depth for Phase 1
```

Use configuration and strategy abstractions.

---

# 66. Definition of Done

The backend is functionally complete when management can reliably answer:

- How much cash do we have?
- How much is in banks?
- How much do customers owe us?
- How much do we owe suppliers?
- What did we sell?
- What did we collect?
- What did we purchase?
- What did we spend?
- What is Gross Profit?
- What is Net Profit?
- What is Cash Flow?
- What is inventory worth?
- How is each branch performing?
- Where is every serial-numbered device?
- Which installments are overdue?
- What does each customer owe?
- What do we owe each supplier?
- What cash and stock does each technician hold?
- Who executed each sensitive operation?
- Can every KPI drill down to source records?

Every answer must be traceable to original transactions.

---

# 67. Architecture Freeze Checklist

Before Phase 1:

- [ ] MongoDB Replica Set works
- [ ] MongoDB transactions work
- [ ] RabbitMQ topology works
- [ ] Publisher confirms work
- [ ] Retry queues work
- [ ] DLQ works
- [ ] Outbox works
- [ ] Inbox idempotency works
- [ ] Redis works
- [ ] Redlock integration works
- [ ] Internal signed token works
- [ ] Company isolation works
- [ ] Branch scope works
- [ ] Correlation IDs propagate
- [ ] OpenTelemetry traces propagate
- [ ] Prometheus metrics work
- [ ] Health endpoints work
- [ ] Graceful shutdown works
- [ ] Shared packages build
- [ ] Turborepo build works
- [ ] Tests run
- [ ] Docker Compose boots complete foundation

---

# 68. Final Architecture Decision

Approved Version 2.0 architecture:

```text
Node.js
Express.js
TypeScript

Domain-Oriented Microservices

MongoDB Replica Set
Mongoose

RabbitMQ
Redis
BullMQ

Database Per Service

Transactional Outbox
Idempotent Inbox
API Idempotency

Persistent Orchestrated Saga

CQRS Reporting Read Models

Double-Entry Accounting
Immutable Financial Ledgers
Immutable Inventory Movements

Decimal128
Decimal.js

Tenant-Aware Security
RBAC
Company Scope
Branch Scope

Docker
pnpm
Turborepo

Pino
OpenTelemetry
Prometheus
Grafana

S3 / MinIO
```

The architecture is designed so that financial correctness, inventory correctness, tenant isolation, event reliability, auditability, and recoverability take precedence over implementation speed.

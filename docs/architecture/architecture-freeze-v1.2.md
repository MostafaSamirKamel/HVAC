# HVAC Enterprise Resource Planning (ERP) — Production Architecture Blueprint (v1.2 Freeze)

---

## 1. Deployable Applications vs. Domain Microservices

The HVAC ERP Backend is composed of **14 deployable applications**:
* **1 Edge API Gateway**: Reverse proxy, SSL termination, JWT authentication, client rate limiting, and signed internal token generation. **Has zero database**.
* **13 Independent Domain Microservices**: Each completely encapsulated around its bounded context, owning a dedicated MongoDB logical database.

| # | Deployable Application | Classification | Owned Database | Port |
|---|---|---|---|---|
| 1 | `api-gateway` | Edge Infrastructure | *None (Stateless)* | 3000 |
| 2 | `identity-service` | Domain Microservice | `hvac_identity` | 4001 |
| 3 | `inventory-service` | Domain Microservice | `hvac_inventory` | 4002 |
| 4 | `purchasing-service` | Domain Microservice | `hvac_purchasing` | 4003 |
| 5 | `customer-service` | Domain Microservice | `hvac_customers` | 4004 |
| 6 | `sales-service` | Domain Microservice | `hvac_sales` | 4005 |
| 7 | `installment-service` | Domain Microservice | `hvac_installments` | 4006 |
| 8 | `finance-service` | Domain Microservice | `hvac_finance` | 4007 |
| 9 | `technician-service` | Domain Microservice | `hvac_technicians` | 4008 |
| 10 | `service-operations-service` | Domain Microservice | `hvac_service_operations` | 4009 |
| 11 | `approval-service` | Domain Microservice | `hvac_approvals` | 4010 |
| 12 | `notification-service`| Domain Microservice | `hvac_notifications` | 4011 |
| 13 | `audit-service` | Domain Microservice | `hvac_audit` | 4012 |
| 14 | `reporting-service` | Domain Microservice | `hvac_reporting` | 4013 |

---

## 2. RabbitMQ Topic Exchange Bindings

* **Exchange**: `hvac.events.topic` (Topic Exchange, Durable).
* **Dead Letter Exchange (DLX)**: `hvac.dlx` (Fanout, routing unhandled dead letters to `q.dead_letter`).
* **Wildcard Rule**: `*` matches exactly **one** segment; `#` matches **zero or more** segments.
* To match versioned events like `inventory.stock.reserved.v1`, bindings MUST use `#` or exact segments.

### Consumer Queue Bindings:

| Consumer Queue | Bound Service | Routing Key Bindings |
|---|---|---|
| `q.inventory_service` | Inventory Service | `purchasing.goods.received.#`, `sales.order.#`, `technician.workorder.#` |
| `q.finance_service` | Finance Service | `sales.sale.#`, `purchasing.bill.#`, `technician.settlement.#`, `inventory.transfer.#` |
| `q.sales_service` | Sales Service | `finance.payment.#`, `inventory.stock.#` |
| `q.installment_service` | Installment Service | `sales.sale.#`, `finance.payment.#` |
| `q.service_ops_service` | Service Operations | `sales.sale.#`, `technician.workorder.#` |
| `q.technician_service` | Technician Service | `service_ops.workorder.#`, `finance.settlement.#` |
| `q.approval_service` | Approval Service | `*.approval.requested.#` |
| `q.notification_service`| Notification Service| `installments.installment.overdue.#`, `approval.request.#`, `inventory.stock.low.#` |
| `q.audit_service` | Audit Service | `audit.#`, `*.changed.#`, `*.created.#`, `*.cancelled.#`, `*.reversed.#` (or `#`) |
| `q.reporting_service` | Reporting Service | `#` (Subscribes to all domain events to project CQRS read models) |

---

## 3. Concurrency & Correctness Guarantee Invariants

* **Redis Redlock Role**: Redlock is used **solely as a high-performance contention reducer** to drop hot simultaneous locks early.
* **Ultimate Source of Correctness**: Absolute correctness is guaranteed at the database engine level by:
  1. **MongoDB Multi-Document Session Transactions** with `writeConcern: { w: 'majority', j: true }` and `readConcern: 'majority'`.
  2. **Conditional Atomic Updates (Optimistic Locking & Guard Queries)**:
     ```typescript
     // Example: Deduct stock only if available quantity is sufficient
     const result = await StockBalanceModel.updateOne(
       {
         companyId,
         warehouseId,
         productId,
         availableQuantity: { $gte: requiredQuantity },
       },
       {
         $inc: {
           availableQuantity: -requiredQuantity,
           reservedQuantity: -requiredQuantity,
           onHandQuantity: -requiredQuantity,
         },
         $set: { updatedAt: new Date() },
       },
       { session },
     );
     if (result.matchedCount === 0) {
       throw new ConflictError('Insufficient available stock for reservation');
     }
     ```
  3. **Tenant-Aware Unique Indexes** on serial numbers and document identifiers.

---

## 4. Multi-Company & Multi-Branch Scoping Policy

* To prevent cross-tenant data leaks, **every operational query MUST start with `companyId`**.
* The query generator in `@hvac/auth-context` enforces:

```typescript
const filter = {
  companyId: auth.companyId,
  ...(auth.isSuperAdmin || !auth.userBranchId
    ? {}
    : auth.allowedBranchIds.length === 1
      ? { branchId: auth.allowedBranchIds[0] }
      : { branchId: { $in: auth.allowedBranchIds } }),
};
```

---

## 5. Tenant-Aware Unique Index Specifications

Unique indexes in a multi-company ERP must incorporate `companyId` so different companies can reuse sequence codes without conflict:

| Collection | Tenant-Aware Unique Index | Business Purpose |
|---|---|---|
| `serial_numbers` | `{ companyId: 1, serialNumber: 1 }` | Prevents serial collision while allowing distinct company inventories. |
| `sales_orders` | `{ companyId: 1, orderNumber: 1 }` | Scopes sales order numbers per company. |
| `sales_invoices` | `{ companyId: 1, invoiceNumber: 1 }` | Scopes official tax invoice numbers per company. |
| `journal_entries` | `{ companyId: 1, entryNumber: 1 }` | Scopes general ledger journal numbers per company. |
| `treasury_ledger` | `{ companyId: 1, receiptNumber: 1 }` | Scopes cash receipt voucher numbers per company. |
| `stock_balances` | `{ companyId: 1, warehouseId: 1, productId: 1 }` | One unified balance record per warehouse/product per company. |
| `installment_schedules`| `{ companyId: 1, contractId: 1, installmentNumber: 1 }` | Unique installment sequence per contract. |

---

## 6 & 7. Cash Sale Saga & Persistent State Machine

### Execution Flow:

```
[1. Create Pending Order]
          ↓
[2. Reserve Stock & Serials]
          ↓
[3. Create Draft/Pending Invoice]
          ↓
[4. Collect Payment in Treasury]
          ↓
[5. Confirm Delivery + Deduct Stock & Assign Serials as SOLD]
          ↓
[6. Post Invoice / Generate Accounting Entries]
          ↓
[7. Mark Order COMPLETED & Finish Saga]
```

### Complete Idempotent Compensations:
* If step 4 (Payment) fails: Delete draft invoice $\to$ Release stock hold $\to$ Cancel Order.
* If step 5 (Stock deduction) fails: Refund payment to treasury $\to$ Delete draft invoice $\to$ Release stock hold $\to$ Cancel Order.
* If step 6 (Posting) fails: **Reverse stock movement** (issue inbound compensation movement) $\to$ **Restore serial state to IN_STOCK** $\to$ **Reverse payment in treasury** $\to$ Cancel Order.

### Persistent Saga State Machine Collection (`hvac_sales.saga_instances`):

```typescript
const SagaInstanceSchema = new Schema({
  sagaId: { type: String, required: true, unique: true },
  sagaType: { type: String, required: true, enum: ['CASH_SALE', 'INSTALLMENT_SALE', 'WAREHOUSE_TRANSFER', 'PURCHASE_RECEIPT', 'REFUND'] },
  companyId: { type: String, required: true, index: true },
  aggregateId: { type: String, required: true, index: true },
  currentStep: { type: String, required: true },
  status: { type: String, enum: ['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED'], default: 'STARTED', index: true },
  completedSteps: [{ stepName: String, completedAt: Date, output: Schema.Types.Mixed }],
  failedStep: { stepName: String, error: String, failedAt: Date },
  retryCount: { type: Number, default: 0 },
  correlationId: { type: String, required: true },
  contextData: { type: Schema.Types.Mixed },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});
```
*On service restart, an active saga runner scans for `IN_PROGRESS` or `COMPENSATING` sagas and resumes orchestration safely.*

---

## 8. Inbox & Idempotency Retention Policy

* **Financial & Inventory Operations**: Processed event IDs (`processed_events`) for payments, financial entries, stock movements, and settlements are **stored permanently** (NO 30-day TTL).
* **Domain-Level Idempotency Guard**: Backed by a database-level unique constraint:
  `{ companyId: 1, referenceType: 1, referenceId: 1 }` on `financial_entries`, `stock_movements`, and `payments`.
* Non-financial operational events (e.g. notifications, temporary emails) retain a 90-day TTL index.

---

## 9 & 10. Source of Truth Definitions: Inventory & Finance

### Inventory:
* **`StockMovement`**: The immutable, append-only ledger and historical source of truth.
* **`StockBalance`**: The current operational projection. It is **never updated directly via API**. It is updated **atomically within the same MongoDB transaction** that writes the `StockMovement`.

### Finance:
* **`TreasuryLedger`**: Immutable movement history of all cash entering or leaving a physical treasury.
* **`JournalEntry`**: Double-entry general ledger accounting source of truth.
* **`Treasury.currentBalance`**: Materialized operational balance, updated atomically within the transaction that commits the ledger entry.

---

## 11 & 12. Ownership Boundaries: Invoices & Pricing

### Document Ownership:
* **Commercial Invoices**: `SalesService` owns `SalesInvoice` documents (billing metadata, line items, customer snapshots, commercial terms).
* **Accounting Postings**: `FinanceService` owns `InvoicePosting` and the resulting `JournalEntry`.
* **Vendor Bills**: `PurchasingService` owns `VendorBill` documents; `FinanceService` owns Accounts Payable entries and payment disbursement ledgers.

### Pricing Ownership:
* **`Catalog/Inventory Service`**: Owns product base prices (purchase cost basis, standard retail price).
* **`Sales Service`**: Owns Price Lists (e.g., Commercial, Retail, Distributor), customer-specific tiered pricing, discount rules, and promotional campaigns.

---

## 13. Decoupled Approval Service Architecture

* `ApprovalService` **never directly modifies another service's records**.
* **Workflow**:
  1. Service initiates request: calls Approval API $\to$ `ApprovalRequest` created (`PENDING`).
  2. Approver approves in Approval Service: state becomes `APPROVED`.
  3. `ApprovalService` publishes `approval.request.approved.v1` via Outbox.
  4. The owning service (e.g. Inventory Service) consumes the event and transitions its own document (e.g. marks `WarehouseTransfer` as `APPROVED` and reserves stock).

---

## 14. Audit Architecture via Transactional Outbox

* Direct cross-database writing to `hvac_audit` from other services is **strictly forbidden**.
* Changes are captured via Mongoose plugins, sanitized (masking passwords, JWTs, card details), and written to `outbox_events` as `audit.entity.changed.v1` inside the domain transaction.
* `AuditService` consumes these events from RabbitMQ and inserts them into `hvac_audit.audit_logs`.

---

## 15. Signed Internal Token (Gateway $\to$ Services)

* API Gateway validates the client JWT, verifies it against the Redis revocation list, and issues a short-lived internal JWT:

```json
{
  "sub": "usr_98765",
  "email": "manager@branch1.hvac.com",
  "companyId": "cmp_001",
  "branchId": "br_cairo_01",
  "allowedBranchIds": ["br_cairo_01", "br_giza_02"],
  "roles": ["branch_manager"],
  "permissions": ["sales:order:create:branch", "inventory:stock:view:branch"],
  "permissionVersion": 14,
  "correlationId": "corr_abc123456",
  "exp": 1727360000
}
```
* Signed with `INTERNAL_SERVICE_SECRET`.
* Downstream services verify the internal token via `@hvac/auth-context` middleware.

---

## 16. Synchronous Commands vs. Asynchronous Events

* **Synchronous REST**:
  - Client state change requests to the owning service (e.g., `POST /api/v1/sales/orders`).
  - Saga Orchestrator command invocations requiring immediate success/failure acknowledgements.
* **Asynchronous RabbitMQ Events**:
  - Resulting state changes published via Outbox (e.g., `sales.order.created.v1`).
  - Cross-domain side-effects, audit logging, push notifications, and CQRS projection updates.

---

## 17 & 18. Reporting Consistency Contract & Read Preferences

* **Eventually Consistent Read Models**: All dashboard and analytical responses return consistency metadata:
  ```json
  {
    "success": true,
    "data": { "totalSales": 1250000, "grossProfit": 380000 },
    "meta": {
      "dataAsOf": "2026-09-26T16:45:10.120Z",
      "projectionLagMs": 340,
      "isEventuallyConsistent": true
    }
  }
  ```
* **Read Preference Policy**:
  - `reporting-service`: Connects with `readPreference: 'secondaryPreferred'` to offload secondary replica nodes.
  - `finance-service` & operational services: Connect with `readPreference: 'primary'` to guarantee immediate read-your-own-writes consistency.

---

## 19. Schema & Data Migration Strategy

* Every Mongoose document includes `schemaVersion: { type: Number, default: 1 }`.
* Migration scripts live in `scripts/database/migrations/` and run sequentially on service deployment.
* Projections in `reporting-service` can be dropped and rebuilt at any time by replaying historical domain events from `audit-service` / Outbox archives.

---

## 20. Standardized Event Versioning Convention

```typescript
{
  "metadata": {
    "eventId": "evt_uuid4",
    "eventType": "inventory.stock.reserved",
    "eventVersion": 1,
    "routingKey": "inventory.stock.reserved.v1",
    "aggregateType": "StockReservation",
    "aggregateId": "res_12345",
    "timestamp": "2026-09-26T16:50:00.000Z",
    "correlationId": "corr_uuid4",
    "companyId": "cmp_001",
    "branchId": "br_001"
  },
  "payload": { ... }
}
```

---

## 21 & 22. Standard Graceful Shutdown & Probes

### 8-Step Shutdown Sequence (on `SIGTERM` / `SIGINT`):
1. **Stop HTTP Listener**: Stop accepting incoming HTTP connections.
2. **Mark Readiness False**: `/health/ready` returns `503 Service Unavailable`.
3. **Drain In-Flight Requests**: Allow pending HTTP transactions up to 15 seconds to finish.
4. **Stop RabbitMQ Consumers**: Cancel channel consumer tags.
5. **Drain Background Jobs**: Allow active BullMQ worker tasks to complete.
6. **Flush Outbox**: Ensure active publishing loops complete current batch.
7. **Close Redis Connections**: Disconnect Redis clients and locks.
8. **Close MongoDB Connection**: Disconnect Mongoose pool gracefully $\to$ Exit code `0`.

### Health Endpoints on All Services:
* `GET /health/live`: Basic process liveness probe (`200 OK`).
* `GET /health/ready`: Dependency health probe (MongoDB connection ready, RabbitMQ channel open, Redis connected). Returns `200` or `503`.
* `GET /metrics`: Prometheus formatted metrics.

---

## 23. Backup & Disaster Recovery Architecture

* **MongoDB Continuous Backup (PITR)**: Daily full snapshot + Continuous Oplog archiving (allowing point-in-time restore to any second in the past 14 days).
* **Object Storage (S3/MinIO)**: Versioned bucket with 30-day lifecycle retention policies for attachments and invoices.
* **RabbitMQ Topology**: Declarative export of exchange/queue definitions saved in version control (`infrastructure/rabbitmq/definitions.json`).
* **Monthly Recovery Drills**: Automated script to spin up fresh container stack, restore latest backup, and verify ledger checksums.

---

## 24 & 25. Integration Testing & Phase 0 Architecture Guardrails

Before writing any business logic in Phase 1 (Identity), Phase 0 must programmatically prove the architectural foundations with automated tests:

1. **Mongo Replica Set Transaction Test**: Verifies multi-document commit and rollback behavior against `mongodb-memory-server` in ReplicaSet mode.
2. **Transactional Outbox $\to$ RabbitMQ Integration Test**: Proves atomic insert of domain model + outbox event, and verifies delivery to broker with publisher confirmation.
3. **Idempotent Consumer Deduplication Test**: Delivers identical event twice; verifies handler runs once and deduplication record is created.
4. **Tenant Scoping Leakage Prevention Test**: Verifies cross-company query rejection.
5. **Redlock & Atomic Condition Race Test**: Simulates 10 concurrent requests attempting to purchase a single remaining stock unit; verifies exactly 1 succeeds and 9 fail gracefully.
6. **Graceful Shutdown Integration Test**: Sends `SIGTERM` to running service while executing a long request; verifies completion before process exit.
7. **Trace Context Propagation Test**: Proves `correlationId` flows from Gateway HTTP request $\to$ RabbitMQ event $\to$ Downstream consumer.

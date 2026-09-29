# Microservices Inventory & Domain Boundaries

## 1. Domain Service Registry

The platform partitions business logic into 13 decoupled domain services and 1 edge gateway.

| Application Name | Directory | Port | Logical Database | Primary Domain Role |
|:---|:---|:---:|:---|:---|
| **api-gateway** | `apps/api-gateway` | `3000` | *None (Stateless)* | Ingress proxy, authentication verification, rate limiting. |
| **identity-service** | `apps/identity-service` | `4001` | `hvac_identity` | Companies, branches, users, roles, permissions, sessions. |
| **inventory-service** | `apps/inventory-service` | `4002` | `hvac_inventory` | Product catalog, warehouses, serial tracking, movements, reservations. |
| **purchasing-service** | `apps/purchasing-service` | `4003` | `hvac_purchasing` | Suppliers, POs, GRN goods receipts, vendor bills. |
| **customer-service** | `apps/customer-service` | `4004` | `hvac_customers` | Customer accounts, branch contracts, credit limits. |
| **sales-service** | `apps/sales-service` | `4005` | `hvac_sales` | Quotations, orders, delivery orders, commercial invoices, Sagas. |
| **installment-service**| `apps/installment-service`| `4006` | `hvac_installments` | Installment contracts, payment schedules, overdue processing. |
| **finance-service** | `apps/finance-service` | `4007` | `hvac_finance` | General ledger, COA, journals, treasuries, payments, allocations. |
| **technician-service** | `apps/technician-service` | `4008` | `hvac_technicians` | Technicians, skill matrix, van stock, cash custody, settlements. |
| **service-operations-service**| `apps/service-operations-service`| `4009` | `hvac_service_ops` | Work orders, maintenance visits, warranties, spare part usages. |
| **approval-service** | `apps/approval-service` | `4010` | `hvac_approvals` | Approval policies, tiered approval steps, decision history. |
| **notification-service**| `apps/notification-service`| `4011`| `hvac_notifications`| SMS, WhatsApp, Email, In-App alerts, template engine. |
| **audit-service** | `apps/audit-service` | `4012` | `hvac_audit` | Append-only audit logs, security event alerts. |
| **reporting-service** | `apps/reporting-service` | `4013` | `hvac_reporting` | CQRS read projections, analytical dashboards, P&L summaries. |

---

## 2. Service Deep Dives & Data Boundaries

### 2.1 Identity Service (`:4001`)
- **Owns**: `companies`, `branches`, `users`, `employees`, `roles`, `permissions`, `sessions`, `refresh_tokens`, `outbox_events`.
- **Emits**: `identity.user.created.v1`, `identity.user.authenticated.v1`, `identity.session.revoked.v1`.
- **Consumes**: None (Root identity provider).

### 2.2 Inventory Service (`:4002`)
- **Owns**: `products`, `brands`, `categories`, `warehouses`, `serial_numbers`, `stock_balances`, `stock_movements`, `stock_reservations`, `warehouse_transfers`, `number_counters`.
- **Emits**: `inventory.stock.reserved.v1`, `inventory.stock.released.v1`, `inventory.stock.deducted.v1`, `inventory.transfer.shipped.v1`, `inventory.transfer.received.v1`.
- **Consumes**: `sales.order.created.v1`, `purchasing.goods.received.v1`, `service.workorder.completed.v1`.

### 2.3 Sales Service (`:4005`)
- **Owns**: `price_lists`, `quotations`, `sales_orders`, `deliveries`, `sales_invoices`, `saga_instances`, `number_counters`.
- **Emits**: `sales.order.created.v1`, `sales.order.confirmed.v1`, `sales.order.cancelled.v1`, `sales.delivery.completed.v1`.
- **Orchestrates**: Cash Sale Saga V2, Installment Sale Saga V2.

### 2.4 Finance Service (`:4007`)
- **Owns**: `chart_of_accounts`, `journal_entries`, `journal_lines`, `treasuries`, `treasury_ledger_entries`, `treasury_balances`, `payments`, `payment_allocations`, `expenses`, `daily_closings`, `financial_periods`.
- **Emits**: `finance.invoice.posted.v1`, `finance.payment.received.v1`, `finance.daily.closed.v1`.
- **Consumes**: `sales.invoice.created.v1`, `purchasing.bill.created.v1`, `installments.payment.applied.v1`.

---

## 3. Cross-Boundary Communication Rules

1. **Zero Database Sharing**: No service ever reads from or writes to another service's MongoDB collection directly.
2. **Synchronous REST**: Reserved strictly for client commands to owning services and Saga orchestrator commands requiring immediate synchronous confirmation.
3. **Asynchronous Events**: Cross-domain updates (e.g. posting accounting entries, creating audit logs, dispatching customer SMS) always flow through RabbitMQ events published via Transactional Outbox.

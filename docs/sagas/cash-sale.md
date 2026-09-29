# Cash Sale Saga V2 — Orchestration & Compensations

## 1. Overview & Business Workflow (Blueprint v2.0 Section 31)

A Cash Sale involves multi-service coordination across Sales, Inventory, and Finance domains. To guarantee consistency without 2-Phase Commit (2PC), the workflow is executed as an **Orchestrated Saga** managed by `apps/sales-service`.

The Saga state is durably stored in MongoDB collection `saga_instances` and survives worker crashes and server restarts.

---

## 2. Forward Execution Flow

```text
 [Client: POST /api/v1/sales/orders]
                  │
                  ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 1: Sales Service                                  │
 │ Create SalesOrder in PENDING status                    │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 2: Inventory Service                              │
 │ Reserve Stock & Specific Serial Numbers                │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 3: Sales Service                                  │
 │ Create Draft Commercial Invoice Document               │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 4: Finance Service                                │
 │ Collect Cash / Card Payment & Post to Treasury Ledger  │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 5: Inventory Service                              │
 │ Confirm Physical Delivery & Deduct Stock Movements     │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 6: Finance Service                                │
 │ Post Accounting Invoice & General Ledger Entries       │
 └────────────────────────┬───────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │ Step 7: Sales Service                                  │
 │ Mark SalesOrder as COMPLETED                           │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Compensation Table (Rollback Matrix)

If an error or network partition occurs at any step, the orchestrator halts forward progress and executes compensating transactions in reverse order:

| Failing Step | Trigger Reason | Compensating Actions Executed | Resulting State |
|:---|:---|:---|:---|
| **Step 2: Reserve Stock** | Insufficient stock or serial already sold | 1. Cancel SalesOrder | `CANCELLED` |
| **Step 3: Draft Invoice** | Validation / tax error | 1. Release Inventory Reservation<br>2. Cancel SalesOrder | `CANCELLED` |
| **Step 4: Collect Payment**| Insufficient client funds / gateway timeout | 1. Cancel Draft Invoice<br>2. Release Inventory Reservation<br>3. Cancel SalesOrder | `CANCELLED` |
| **Step 5: Deduct Stock** | Warehouse defect / damaged serial | 1. Reverse Finance Payment (Refund to safe)<br>2. Cancel Draft Invoice<br>3. Release Inventory Reservation<br>4. Cancel SalesOrder | `COMPENSATED` |
| **Step 6: Post Accounting**| Locked accounting period | 1. Reverse Stock Movement (Restore On-Hand)<br>2. Restore Serial Status to IN_STOCK<br>3. Reverse Finance Payment<br>4. Cancel Draft Invoice<br>5. Cancel SalesOrder | `COMPENSATED` |

---

## 4. Idempotency of Compensation Commands

Every compensation command (e.g. `POST /api/v1/inventory/reservations/:id/release`, `POST /api/v1/finance/payments/:id/reverse`) is strictly idempotent. Re-executing a compensation step after network interruption safely succeeds without double-reversing.

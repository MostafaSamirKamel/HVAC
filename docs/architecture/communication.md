# Inter-Service Communication & Event Mesh

## 1. Synchronous REST vs. Asynchronous Events (Blueprint v2.0 Section 50)

The HVAC ERP strictly segregates communication patterns based on consistency requirements:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           Synchronous REST                             │
 │    • Client command invocation to owning service                       │
 │    • Saga Orchestrator steps requiring immediate pass/fail             │
 │    • Real-time availability verification queries                       │
 └────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │
                             Direct HTTP/JSON
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Asynchronous RabbitMQ Mesh                        │
 │    • Domain state-change propagation via Transactional Outbox          │
 │    • CQRS analytical read-model projections                            │
 │    • Audit log ingestion and compliance capture                        │
 │    • Push notifications (SMS, WhatsApp, Email)                         │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. RabbitMQ Topology & Routing Architecture (Blueprint v2.0 Section 26)

### 2.1 Exchanges
- **Main Topic Exchange**: `hvac.events.topic` (Type: `topic`, Durable: `true`)
- **Dead Letter Exchange (DLX)**: `hvac.dlx` (Type: `direct`, Durable: `true`)

### 2.2 Queues & Bindings
Each consuming microservice binds its dedicated durable queue to `hvac.events.topic` using domain topic patterns:

| Queue Name | Routing Key Pattern | Consuming Service | Dead Letter Routing |
|:---|:---|:---|:---|
| `q.inventory_service` | `inventory.#` | Inventory Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.sales_service` | `sales.#` | Sales Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.finance_service` | `finance.#`, `sales.invoice.*`, `purchasing.bill.*` | Finance Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.installment_service` | `installments.#`, `finance.payment.*` | Installment Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.technician_service` | `technician.#` | Technician Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.service_operations` | `service.#` | Service Operations | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.approval_service` | `approval.#` | Approval Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.notification_service`| Specific triggering topics | Notification Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.audit_service` | `#` (Wildcard: All Events) | Audit Service | `hvac.dlx` $\to$ `q.dead_letter` |
| `q.reporting_service` | `#` (Wildcard: All Events) | Reporting Service | `hvac.dlx` $\to$ `q.dead_letter` |

---

## 3. Reliability & Delivery Guarantees

1. **Publisher Confirms**: Outbox workers never mark an outbox event as `PUBLISHED` until RabbitMQ positively acknowledges receipt (`waitForConfirmsOrDie`).
2. **Persistent Messages**: All published messages are tagged with `deliveryMode: 2` (Persistent) to survive broker restarts.
3. **Dead Letter Handling**: Messages failing processing after max attempts (default: 3) are routed to `hvac.dlx` $\to$ `q.dead_letter` with exception metadata attached in headers for operator investigation.
4. **Permanent Idempotent Inbox**: Financial and inventory consumers store processed `eventId` keys with permanent retention to guarantee zero double-crediting or double-deducting under at-least-once delivery.

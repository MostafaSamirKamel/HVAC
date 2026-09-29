# System Architecture Overview — Version 2.0

## 1. Executive Summary

The **HVAC Enterprise Resource Planning (ERP)** backend is a high-concurrency, event-driven, domain-oriented distributed system built for enterprise multi-branch HVAC equipment distribution, contracting, and field maintenance operations.

The platform coordinates **14 deployable applications** (13 domain microservices + 1 Edge API Gateway), completely isolated logical databases, a distributed RabbitMQ event mesh, transactional outbox/inbox reliability, persistent orchestrated sagas, and CQRS analytical read models.

---

## 2. High-Level C4 Container Topology

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Client Applications (Web / Mobile)                │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                        Edge API Gateway (:3000)                        │
 │ Reverse Proxy • SSL Termination • Client Rate Limiting • Token Minting │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Internal Signed JWT Network
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 ┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
 │ Core Operations   │       │ Financial Domain  │       │ Field Operations  │
 ├───────────────────┤       ├───────────────────┤       ├───────────────────┤
 │ Identity   (:4001)│       │ Finance    (:4007)│       │ Technician (:4008)│
 │ Inventory  (:4002)│       │ Installment(:4006)│       │ ServiceOps (:4009)│
 │ Purchasing (:4003)│       └───────────────────┘       └───────────────────┘
 │ Customer   (:4004)│
 │ Sales      (:4005)│
 └───────────────────┘
         │
         │   ┌───────────────────────────────────────────────────────────┐
         └──►│                  Cross-Cutting Services                   │
             ├───────────────────────────────────────────────────────────┤
             │ Approval   (:4010) │ Notification (:4011)                 │
             │ Audit      (:4012) │ Reporting    (:4013)                 │
             └───────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ═══════════════════════════════════════════════════════════════════════════════
                             RabbitMQ Event Mesh
               Topic: hvac.events.topic   •   DLX: hvac.dlx
 ═══════════════════════════════════════════════════════════════════════════════
                 │                            │                    │
                 ▼                            ▼                    ▼
     MongoDB 7.0 Replica Set           Redis 7.2 Cluster       MinIO / S3
        (Logical DB per Svc)         Locks • Cache • BullMQ  Object Storage
```

---

## 3. Technology Stack & Component Responsibilities

| Tier | Component | Technology | Architectural Rationale |
|:---|:---|:---|:---|
| **Edge Ingress** | API Gateway | Node.js + Express + Helmet | Stateless ingress routing, rate limiting, and client auth exchange. |
| **Domain Services** | 13 Microservices | Node.js + TypeScript (Strict) | Clean domain boundaries, isolated compile targets, zero cross-dependencies. |
| **Persistence** | Primary Database | MongoDB 7.0 Replica Set (`rs0`) | ACID multi-document transactions, rich schema modeling, horizontal scaling. |
| **Messaging** | Event Broker | RabbitMQ 3.13 (Topic + DLX) | At-least-once persistent messaging, routing keys, Dead Letter Exchanges. |
| **Distributed Cache** | Cache / Locks | Redis 7.2 + Redlock | Distributed locking for serials/stock, token revocation, sliding window rate limits. |
| **Background Jobs** | Schedulers | BullMQ / JobManager | Idempotent background schedulers for overdue detection, reminders, and cleanup. |
| **File Storage** | Attachments | S3 API / MinIO | Scalable binary object storage for invoices, receipts, and photos. |
| **Monorepo** | Build & Tooling | pnpm Workspaces + Turborepo | Fast incremental caching, strict workspace boundary enforcement. |
| **Observability** | Telemetry | Pino + Prometheus + OpenTelemetry | Structured JSON logging, distributed trace context propagation, metric counters. |

---

## 4. Key Architectural Guarantees

1. **Financial Correctness**:
   - Zero JavaScript floating-point arithmetic on monetary values.
   - All balances and journals use `Decimal128` and `@hvac/money`.
   - Every journal entry strictly balances: `Total Debit == Total Credit`.
2. **Strict Multi-Tenant Isolation**:
   - Every collection includes `companyId`.
   - All unique constraints are compound indexes: `{ companyId: 1, ... }`.
   - Direct cross-company data access is blocked at the gateway and repository layers.
3. **Database-Per-Service**:
   - No microservice connects to another microservice's database.
   - Foreign entity references are primitive string IDs (`userId`, `productId`, `orderId`).
4. **Reliability & Idempotency**:
   - State-changing events are written atomically with business aggregates via Transactional Outbox.
   - Message consumers use persistent Idempotent Inboxes to safely ignore duplicate deliveries.

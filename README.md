# HVAC Enterprise Resource Planning (ERP) — Microservices Backend (Version 2.0)

An event-driven, high-concurrency microservices backend tailored for enterprise HVAC (Heating, Ventilation, and Air Conditioning) distributors, contractors, and field service companies.

Built with **Node.js, Express, TypeScript, Turborepo, MongoDB 7.0 Replica Set (`rs0`), RabbitMQ, Redis, BullMQ, and S3-Compatible Object Storage (MinIO)**.

---

## 🏛️ System Architecture Blueprint

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

## 📦 Monorepo Applications & Shared Packages

### Applications (`apps/` — 14 Deployable Services)
1. **`api-gateway`** (`:3000`): Stateless entry point, reverse proxy, client rate limiting, internal signed token generation (Rule 15).
2. **`identity-service`** (`:4001`): Authentication (Argon2id), sessions, refresh token rotation, multi-tenant RBAC.
3. **`inventory-service`** (`:4002`): Catalog, serial unit tracking, multi-warehouse stock balances, transfers, and FIFO/Average costing.
4. **`purchasing-service`** (`:4003`): Suppliers, purchase requests, RFQs, purchase orders, goods receipts (GRN), and vendor bills.
5. **`customer-service`** (`:4004`): Customer accounts, CRM contacts, branch locations, and commercial credit limits.
6. **`sales-service`** (`:4005`): Price lists, quotations, sales orders, delivery notes, and Cash/Installment Saga orchestration.
7. **`installment-service`** (`:4006`): Long-term installment plans, monthly payment schedules, and overdue penalties.
8. **`finance-service`** (`:4007`): Chart of accounts, double-entry journals (`Debit == Credit`), treasuries, and cash flow.
9. **`technician-service`** (`:4008`): Field technicians, van vehicle inventory, cash custody, and commission settlements.
10. **`service-operations-service`** (`:4009`): Service tickets, work orders, installations, warranties, and maintenance visits.
11. **`approval-service`** (`:4010`): Dynamic approval rules, multi-tier approval chains, and append-only audit trail.
12. **`notification-service`** (`:4011`): Multi-channel dispatch (SMS, WhatsApp, Email, In-App), templates, and 90-day TTL.
13. **`audit-service`** (`:4012`): Append-only immutable compliance logs and security telemetry.
14. **`reporting-service`** (`:4013`): CQRS read models, sales funnels, valuation, and Rule 17 consistency contracts.

### Shared Packages (`packages/` — 16 Core Packages)
- **`@hvac/database`**: MongoDB Replica Set transactions, Transactional Outbox, Idempotent Inbox, atomic document counters.
- **`@hvac/storage`**: S3 & MinIO object storage adapter, MIME/size file upload validation, presigned URLs.
- **`@hvac/jobs`**: BullMQ distributed background job schedulers, retry backoff, and graceful draining.
- **`@hvac/money`**: Zero-drift exact financial calculations using `Decimal128` and Dinero.js.
- **`@hvac/auth-context`**: Cryptographic internal token verification, `TenantBranchScope`, and permission evaluation.
- **`@hvac/errors`**: Standardized domain exception classes and error taxonomy.
- **`@hvac/logger`**: Fast structured JSON logging powered by Pino with automatic secret masking.
- **`@hvac/messaging`**: RabbitMQ topic exchange topology and publisher confirm publishers.
- **`@hvac/redis`**: Redis client, distributed lock (`DistributedLock`), cache, and token revocation lists.
- **`@hvac/observability`**: Trace context (`x-correlation-id`), Prometheus `/metrics`, OpenTelemetry spans.
- **`@hvac/api-contracts`**: Standard request/response envelopes and DTO types.
- **`@hvac/event-contracts`**: Standard domain event envelope (`DomainEvent<T>`) and event schemas.
- **`@hvac/config`**: Environment variable validation and service discovery via Zod.
- **`@hvac/testing`**: Reusable mocks, factories, and integration test helpers.
- **`@hvac/tsconfig`**: Shared strict TypeScript compiler configurations.
- **`@hvac/eslint-config`**: Shared linting and code quality rules.

---

## 📚 Comprehensive Documentation Directory

| Document | Path | Description |
|:---|:---|:---|
| **Architecture Blueprint v2.0** | [HVAC_ERP_Microservices_Architecture_v2.0.md](file:///c:/Users/mosta/Desktop/HVAC/HVAC_ERP_Microservices_Architecture_v2.0.md) | Complete 2,530-line enterprise architectural blueprint. |
| **API Conventions** | [docs/api/conventions.md](file:///c:/Users/mosta/Desktop/HVAC/docs/api/conventions.md) | REST design, response envelopes, pagination, sorting, headers. |
| **Error Taxonomy** | [docs/api/errors.md](file:///c:/Users/mosta/Desktop/HVAC/docs/api/errors.md) | Machine-readable error codes, HTTP statuses, and JSON schemas. |
| **API Endpoints Catalog** | [docs/api/endpoints.md](file:///c:/Users/mosta/Desktop/HVAC/docs/api/endpoints.md) | Exhaustive route reference across all 13 domain microservices. |
| **API Gateway & Rate Limiting**| [docs/api/gateway.md](file:///c:/Users/mosta/Desktop/HVAC/docs/api/gateway.md) | Reverse proxy, token exchange (Rule 15), and sliding window rate limits. |
| **System Overview** | [docs/architecture/system-overview.md](file:///c:/Users/mosta/Desktop/HVAC/docs/architecture/system-overview.md) | Executive C4 container topology and technology stack. |
| **Microservices Inventory** | [docs/architecture/microservices.md](file:///c:/Users/mosta/Desktop/HVAC/docs/architecture/microservices.md) | Database ownership, ports, boundaries, and dependencies. |
| **Inter-Service Communication**| [docs/architecture/communication.md](file:///c:/Users/mosta/Desktop/HVAC/docs/architecture/communication.md) | Synchronous REST vs. Asynchronous RabbitMQ event mesh. |
| **Data Ownership & Snapshots** | [docs/architecture/data-ownership.md](file:///c:/Users/mosta/Desktop/HVAC/docs/architecture/data-ownership.md) | Isolated databases, historical snapshots, and immutable ledgers. |
| **Deployment Strategy** | [docs/architecture/deployment.md](file:///c:/Users/mosta/Desktop/HVAC/docs/architecture/deployment.md) | Docker Compose, multi-stage Turbo builds, Kubernetes readiness. |
| **Domain Event Catalog** | [docs/events/event-catalog.md](file:///c:/Users/mosta/Desktop/HVAC/docs/events/event-catalog.md) | Complete list of all domain events, triggers, and payload types. |
| **Transactional Outbox** | [docs/events/outbox.md](file:///c:/Users/mosta/Desktop/HVAC/docs/events/outbox.md) | Outbox pattern, ACID transactions, lease locking, and publisher confirms. |
| **Idempotent Inbox** | [docs/events/inbox.md](file:///c:/Users/mosta/Desktop/HVAC/docs/events/inbox.md) | Consumer deduplication and permanent financial retention. |
| **Financial Engine** | [docs/finance/financial-engine.md](file:///c:/Users/mosta/Desktop/HVAC/docs/finance/financial-engine.md) | Double-entry accounting, Decimal128, COA, and treasury ledgers. |
| **Cash Sale Saga V2** | [docs/sagas/cash-sale.md](file:///c:/Users/mosta/Desktop/HVAC/docs/sagas/cash-sale.md) | 7-step orchestrated cash sale workflow and rollback matrix. |
| **Installment Sale Saga V2** | [docs/sagas/installment-sale.md](file:///c:/Users/mosta/Desktop/HVAC/docs/sagas/installment-sale.md) | Credit checks, amortization schedules, and down payments. |
| **Authentication & Tokens** | [docs/security/authentication.md](file:///c:/Users/mosta/Desktop/HVAC/docs/security/authentication.md) | Argon2id, 15m JWT, 7d refresh rotation, Redis revocation. |
| **RBAC & Authorization** | [docs/security/authorization.md](file:///c:/Users/mosta/Desktop/HVAC/docs/security/authorization.md) | `resource:action:scope` permission format and versioning. |
| **Tenant & Branch Scoping** | [docs/security/branch-scope.md](file:///c:/Users/mosta/Desktop/HVAC/docs/security/branch-scope.md) | `TenantBranchScope`, forced query filters, compound indexing. |
| **Service-to-Service Security**| [docs/security/service-to-service.md](file:///c:/Users/mosta/Desktop/HVAC/docs/security/service-to-service.md) | Zero-trust signed internal service tokens (60s lifetime). |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: >= 20.x
- **pnpm**: >= 9.x
- **Docker & Docker Compose**

### 2. Boot Local Infrastructure
Starts MongoDB 7.0 Replica Set (`rs0`), Redis 7.2, RabbitMQ 3.13 Management, and MinIO S3 Object Storage:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Build All Packages & Microservices
```bash
pnpm -r run build
```

### 5. Run the Integration Test Suite
Executes 202 comprehensive integration and concurrency guardrail tests:
```bash
npx vitest run tests/integration
```

### 6. Start the API Gateway & Services
```bash
pnpm dev
```
- **API Gateway**: `http://localhost:3000`
- **Liveness Probe**: `GET http://localhost:3000/health/live`
- **Readiness Probe**: `GET http://localhost:3000/health/ready`
- **Prometheus Metrics**: `GET http://localhost:3000/metrics`
- **RabbitMQ Management**: `http://localhost:15672` (guest / guest)
- **MinIO Console**: `http://localhost:9001` (minioadmin / minioadmin)
# HVAC

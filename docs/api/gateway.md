# Edge API Gateway Architecture, Routing & Security

## 1. Overview & Architectural Role

The **Edge API Gateway** (`apps/api-gateway`) acts as the single unified ingress point for all client traffic across web dashboards, mobile applications, and external partner integrations.

Following **Architecture Freeze v1.2**:
- **Stateless & Database-Free**: The Gateway maintains **zero database connections** and stores no persistent business entities.
- **SSL Termination & Reverse Proxy**: Reverse-proxies client HTTP/HTTPS requests to internal microservices listening on private loopback / container network ports (ports 4001–4013).
- **Client Authentication & Token Exchange (Rule 15)**: Validates client Bearer JWTs, checks token revocation, and issues short-lived (60s) internal service tokens signed with `INTERNAL_SERVICE_SECRET`.
- **Client Rate Limiting**: Enforces rate limiting per IP / authenticated user with Redis backing and in-memory failover.
- **Trace Context Propagation**: Injects or forwards `x-correlation-id` across all proxied downstream calls.
- **Observability & Probes (Rule 21 & Rule 22)**: Exposes standardized `/health`, `/health/live`, `/health/ready`, and `/metrics` endpoints.

---

## 2. Microservice Routing & Proxy Topology

| Service | Prefix / Path | Target Port | Access Tier | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Identity Service** | `/api/v1/auth` | `4001` | Public | Login, token refresh, password resets |
| **Identity Service** | `/api/v1/users` | `4001` | Protected | User profiles, roles, permissions |
| **Inventory Service** | `/api/v1/inventory` | `4002` | Protected | Catalog, stock levels, warehouse transfers |
| **Purchasing Service** | `/api/v1/purchasing` | `4003` | Protected | Suppliers, POs, GRNs, vendor bills |
| **Customer Service** | `/api/v1/customers` | `4004` | Protected | Customer profiles, branches, CRM contacts |
| **Sales Service** | `/api/v1/sales` | `4005` | Protected | Quotations, sales orders, deliveries |
| **Installment Service** | `/api/v1/installments`| `4006` | Protected | Installment plans, payment schedules |
| **Finance Service** | `/api/v1/finance` | `4007` | Protected | General ledger, charts of accounts, journals |
| **Technician Service** | `/api/v1/technicians` | `4008` | Protected | Technician rosters, skills, vehicle stock |
| **Service Operations** | `/api/v1/service-ops` | `4009` | Protected | Maintenance jobs, work orders, service tickets |
| **Approval Service** | `/api/v1/approvals` | `4010` | Protected | Threshold policies, approval multi-tier chains |
| **Notification Service**| `/api/v1/notifications`| `4011`| Protected | Email, SMS, WhatsApp, In-App alerts |
| **Audit Service** | `/api/v1/audit` | `4012` | Protected | Immutable audit trail, compliance logs |
| **Reporting Service** | `/api/v1/reports` | `4013` | Protected | CQRS read-model dashboards & P&L summaries |

---

## 3. Client Authentication & Signed Internal Token Generation (Rule 15)

1. Client sends an HTTP request with `Authorization: Bearer <client_jwt>`.
2. The Gateway `authMiddleware`:
   - Validates client signature against `JWT_SECRET`.
   - Checks Redis revocation list (`revoked_token:<token>`) to immediately reject revoked sessions.
   - Extracts tenant identity (`userId`, `companyId`, `branchId`, `roles`, `permissions`, `permissionVersion`).
   - Mints a short-lived internal JWT (expiry: 60 seconds) signed with `INTERNAL_SERVICE_SECRET`.
   - Attaches downstream headers:
     - `x-internal-token`: Signed internal JWT.
     - `x-correlation-id`: Trace context ID.
     - `x-user-id`: Client user ID.
     - `x-company-id`: Strict tenant isolation identifier.
     - `x-branch-id`: Active branch scope (if assigned).
3. Downstream microservices verify the internal token with `@hvac/auth-context` without querying the Identity database.

---

## 4. Rate Limiting Strategy (Rule 8)

The Gateway uses a sliding window rate limiter backed by Redis with seamless in-memory fallback:
- **Default Window**: 60 seconds (100 requests per IP or per authenticated user).
- **Exempt Endpoints**: Health probes (`/health`, `/health/live`, `/health/ready`) and metrics (`/metrics`).
- **Response Headers**:
  - `X-RateLimit-Limit`: Maximum allowed requests per window.
  - `X-RateLimit-Remaining`: Remaining request quota.
  - `X-RateLimit-Reset`: Unix timestamp when quota resets.
- **Throttling Action**:
  - Exceeding limit immediately triggers HTTP `429 Too Many Requests`.
  - Sets `Retry-After: <seconds>` header.
  - Standard JSON response:
    ```json
    {
      "success": false,
      "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Rate limit exceeded. Maximum 100 requests per 60s."
      }
    }
    ```

---

## 5. Observability & Graceful Shutdown (Rule 21 & Rule 22)

### Observability Endpoints:
- `GET /health`: Basic service status and timestamp.
- `GET /health/live`: Liveness probe indicating process is alive and reporting uptime.
- `GET /health/ready`: Readiness probe returning `200 OK` during normal operation, and `503 Service Unavailable` during shutdown drainage.
- `GET /metrics`: Standardized Prometheus/OpenTelemetry metrics snapshot via `MetricsCollector.flush()`.

### Graceful Shutdown Lifecycle:
1. Signal capture (`SIGTERM` or `SIGINT`).
2. Immediate readiness toggle: `setReadiness(false)` returning 503 on `/health/ready`.
3. Stop accepting new inbound HTTP connections while letting in-flight requests complete cleanly.
4. Close open Redis connections (`closeRedis()`).
5. Terminate process cleanly (`process.exit(0)`).
6. 15-second safety watchdog timeout (`setTimeout`) to force-kill stuck connections.

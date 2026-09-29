# Service-to-Service Security & Signed Internal Tokens

## 1. Zero-Trust Gateway-to-Service Architecture (Rule 15 & Blueprint v2.0 Section 8)

In a microservices architecture, internal microservices should never blindly trust incoming HTTP headers (like `x-user-id` or `x-company-id`) because an attacker inside the network could spoof them.

The HVAC ERP implements a **Signed Internal Service Token** protocol:

```text
 Client Request                           Edge API Gateway                          Downstream Microservice
 (Authorization: Bearer <client_jwt>)                                              (e.g. Sales, Finance)
         │                                        │                                           │
         │─── 1. Ingress Request ────────────────►│                                           │
         │                                        ├── 2. Validate Client JWT                  │
         │                                        ├── 3. Check Redis Revocation               │
         │                                        └── 4. Mint Signed Internal JWT             │
         │                                               (Lifetime: 60s,                      │
         │                                                Secret: INTERNAL_SERVICE_SECRET)    │
         │                                                │                                   │
         │                                                │─── 5. Forward with Header ───────►│
         │                                                │       x-internal-token: <jwt>     │
         │                                                │       x-correlation-id: <uuid>    ├── 6. Verify Signature
         │                                                │                                   ├── 7. Extract AuthContext
         │                                                │                                   └── 8. Execute Command
```

---

## 2. Internal Token Claims Payload

The internal token is short-lived (60 seconds) and signed with `INTERNAL_SERVICE_SECRET`:

```json
{
  "sub": "usr_branch_mgr_01",
  "email": "manager@cairo.hvac.com",
  "companyId": "comp_cairo_hvac",
  "branchId": "br_nasr_city",
  "allowedBranchIds": ["br_nasr_city", "br_heliopolis"],
  "roles": ["branch_manager"],
  "permissions": [
    "sales:order:create:branch",
    "inventory:stock:view:branch",
    "discount:approve:branch"
  ],
  "permissionVersion": 14,
  "correlationId": "corr_89af12-bc78-41",
  "iat": 1727440000,
  "exp": 1727440060
}
```

---

## 3. Verification Middleware (`@hvac/auth-context`)

Every domain microservice protects its routes using `requireInternalAuth`:

```ts
import { requireInternalAuth, requirePermission } from '@hvac/auth-context';

router.post(
  '/orders',
  requireInternalAuth(),
  requirePermission('sales:order:create:branch'),
  orderController.createOrder
);
```

### Security Benefits
- **Zero Database Call for Auth**: Downstream services verify the user's roles, company, and permissions in CPU memory in microseconds without querying the Identity database.
- **Spoofing Prevention**: Stripping or ignoring unauthenticated headers guarantees that even if an internal pod is compromised, it cannot forge requests across tenants without the cryptographic secret.

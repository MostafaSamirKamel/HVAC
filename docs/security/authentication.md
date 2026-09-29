# Authentication & Token Lifecycle Management

## 1. Overview & Security Standards (Blueprint v2.0 Section 7)

The HVAC ERP implements a stateless, token-based authentication architecture supported by Redis revocation lists and Argon2id password hashing.

### Core Security Invariants
1. **Password Hashing**: Passwords are never stored in plaintext. They are hashed using **Argon2id** (with high memory cost and parallelization factors) to resist GPU brute-force attacks.
2. **Access Token Lifetime**: Short-lived (15 minutes) signed with `JWT_SECRET`.
3. **Refresh Token Lifetime**: Long-lived (7 days) with mandatory single-use rotation.
4. **Token Revocation (Blacklisting)**: Logged-out or revoked tokens are stored in Redis (`revoked_token:<token>`) and verified at the Edge API Gateway.

---

## 2. Authentication Flow

```text
 Client (Browser / Mobile)                  API Gateway                     Identity Service
           │                                     │                                 │
           │── 1. POST /api/v1/auth/login ──────►│── 2. Proxy Request ────────────►│
           │      { email, password }            │                                 │
           │                                     │                                 ├── Verify Argon2id Hash
           │                                     │                                 ├── Check User Active
           │                                     │                                 └── Generate Access & Refresh Tokens
           │                                     │◄─ 3. Return Tokens & User ──────┤
           │◄─ 4. Return Response ───────────────┤
```

---

## 3. Refresh Token Rotation (RTR)

To prevent replay attacks if a refresh token is leaked:
1. When a client requests `POST /api/v1/auth/refresh`, the presented refresh token is immediately invalidated in the database.
2. A new refresh token and access token pair are issued.
3. If an already-used refresh token is presented a second time, the Identity Service flags a **Security Breach Event** (`security_events`), invalidates all active sessions for that user, and blocks subsequent requests.

---

## 4. Token Revocation & Logout (Rule 15)

When a user logs out or an administrator revokes a compromised session:
- The token signature is stored in Redis with a TTL matching the token's remaining expiration time (`SETEX revoked_token:<token> <ttl> 1`).
- The API Gateway checks this revocation list on every incoming request. If found, it immediately rejects the request with `401 AUTHENTICATION_REQUIRED`.

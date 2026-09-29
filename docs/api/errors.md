# Error Handling & Enterprise Error Taxonomy

## 1. Overview & Structured Error Envelope

The HVAC ERP platform uses a uniform, machine-readable error format across all 14 applications. Client applications should inspect the `error.code` string field to handle failures deterministically.

### Standard Error JSON Schema (Blueprint v2.0 Section 40)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Available stock quantity (4) is less than requested quantity (10).",
    "details": {
      "productId": "prod_carrier_split_18k",
      "warehouseId": "wh_nasr_city_01",
      "availableQuantity": 4,
      "requestedQuantity": 10
    }
  },
  "requestId": "req_88f912da-4a57-41eb-bc87-9bb3a6771d99"
}
```

---

## 2. Complete Error Taxonomy (Blueprint v2.0 Section 41)

| Error Code | HTTP Status | Domain Source | Description |
|:---|:---:|:---|:---|
| `VALIDATION_ERROR` | `400` | Common / Zod | Malformed payload, invalid format, missing required fields. |
| `AUTHENTICATION_REQUIRED` | `401` | Gateway / Identity | Missing, malformed, expired, or invalid Bearer JWT. |
| `FORBIDDEN` | `403` | Identity / AuthContext | Insufficient RBAC permissions or unauthorized company/branch access. |
| `RESOURCE_NOT_FOUND` | `404` | All Services | The requested aggregate ID does not exist in the tenant's database. |
| `RESOURCE_CONFLICT` | `409` | All Services | Duplicate unique key (e.g., duplicate SKU, username, or invoice number). |
| `INSUFFICIENT_STOCK` | `400` | Inventory | Attempted stock deduction/reservation exceeds current `onHand - reserved`. |
| `SERIAL_UNAVAILABLE` | `409` | Inventory | Serialized unit is not currently in `IN_STOCK` status. |
| `SERIAL_ALREADY_SOLD` | `409` | Inventory / Sales | Attempted sale of a serial number that has already transitioned to `SOLD`. |
| `PAYMENT_ALREADY_PROCESSED` | `409` | Finance | Attempted duplicate payment processing against the same invoice/installment. |
| `PERIOD_LOCKED` | `422` | Finance | Attempted financial entry or journal modification inside a closed accounting period. |
| `APPROVAL_REQUIRED` | `403` | Approval / Sales | Action requires manager sign-off (e.g., high discount or high-value PO). |
| `CREDIT_LIMIT_EXCEEDED` | `422` | Customer / Sales | Commercial customer balance + order total exceeds configured credit limit. |
| `TRANSFER_ALREADY_RECEIVED` | `409` | Inventory | Attempted double-receipt of an internal warehouse transfer. |
| `IDEMPOTENCY_CONFLICT` | `409` | Gateway / Common | An operation with the same `Idempotency-Key` is currently executing or failed. |
| `RATE_LIMIT_EXCEEDED` | `429` | Gateway | Client exceeded API rate limit quota (includes `Retry-After` header). |
| `SAGA_FAILED` | `500` | Sales / Installments | Distributed transaction failure where step compensation failed or aborted. |
| `INTERNAL_SERVER_ERROR` | `500` | Gateway / All | Unhandled server exception; details are masked for security. |

---

## 3. Detailed Error Examples

### 3.1 Validation Error (`400 Bad Request`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed on request body",
    "details": {
      "fieldErrors": [
        { "field": "customerPhone", "message": "Phone number must be a valid 11-digit Egyptian mobile number" },
        { "field": "downPayment", "message": "Down payment cannot exceed total order price" }
      ]
    }
  },
  "requestId": "req_val_001122"
}
```

### 3.2 Period Locked Error (`422 Unprocessable Entity`)
```json
{
  "success": false,
  "error": {
    "code": "PERIOD_LOCKED",
    "message": "Cannot post journal entry: Accounting period for February 2026 is closed.",
    "details": {
      "periodId": "period_2026_02",
      "closedAt": "2026-03-01T00:00:00Z",
      "closedBy": "usr_financial_controller_01"
    }
  },
  "requestId": "req_fin_992288"
}
```

### 3.3 Rate Limit Exceeded (`429 Too Many Requests`)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Maximum 100 requests per 60 seconds.",
    "details": {
      "limit": 100,
      "windowSeconds": 60,
      "retryAfterSeconds": 24
    }
  },
  "requestId": "req_rl_445566"
}
```

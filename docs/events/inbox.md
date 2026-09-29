# Idempotent Inbox & Consumer Deduplication

## 1. At-Least-Once Delivery & Duplicate Processing Risks

RabbitMQ and distributed networks guarantee **at-least-once message delivery**. Network timeouts, worker reconnections, or redeliveries can cause a consumer to receive the exact same domain event multiple times.

In an ERP system, duplicate event processing without idempotency causes catastrophic errors:
- Double-crediting or double-debiting customer accounts.
- Double-deducting physical stock in warehouses.
- Duplicate invoice or payment creations.

---

## 2. Idempotent Inbox Pattern (Blueprint v2.0 Section 28)

Every critical event consumer executes message handling inside an idempotent inbox boundary:

```text
 RabbitMQ Event
       │
       ▼
 ┌────────────────────────────────────────────────────────┐
 │ 1. Check Inbox: (eventId + consumerName)               │
 └─────────────────────────┬──────────────────────────────┘
                           │
             Already Processed?
             ├─── YES ───► ACK RabbitMQ & Exit (No Side Effects)
             │
             └─── NO  ───► Begin Local MongoDB Transaction
                           ├── Execute Domain State Mutation
                           ├── Insert Processed Event Record
                           └── Commit Transaction & ACK RabbitMQ
```

---

## 3. Processed Event Schema (`processed_events`)

```ts
interface ProcessedEventDocument {
  eventId: string;          // Originating event UUID
  consumerName: string;     // Unique consumer service name (e.g. 'finance:invoice-handler')
  eventType: string;        // Domain event type
  companyId: string;        // Tenant isolation
  processedAt: Date;
  status: 'PROCESSED' | 'FAILED';
  retentionType: 'PERMANENT' | 'STANDARD';
  expireAt?: Date;          // TTL index field (only for STANDARD retention)
}
```

### Compound Unique Index
```js
{ eventId: 1, consumerName: 1 } // unique: true
```
This compound unique index guarantees that even under extreme concurrency (e.g. two consumer pods simultaneously receiving the same message), exactly one succeeds, while the other hits a MongoDB duplicate key error and safely discards the duplicate.

---

## 4. Permanent vs. Standard Retention Policy (Rule 8 & 14)

1. **Permanent Retention (`retentionType: 'PERMANENT'`)**:
   - Mandatory for all **Finance**, **Inventory**, and **Installment** consumers.
   - These records **never expire**. Even if an event from 3 years ago is replayed during disaster recovery, it will never double-post financial or stock movements.
2. **Standard Retention (`retentionType: 'STANDARD'`)**:
   - Used only for low-risk side-effects (e.g. `notification-service` email/SMS delivery).
   - Managed via MongoDB TTL index (`expireAfterSeconds: 90 * 24 * 60 * 60` — 90 days).

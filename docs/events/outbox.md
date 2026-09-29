# Transactional Outbox Architecture & Publishing Engine

## 1. The Distributed Dual-Write Problem

In a microservices architecture, mutating an internal database and publishing an event to a message broker (RabbitMQ) without a distributed transaction causes data inconsistency:
- If the database commit succeeds but the network crashes before publishing, downstream services miss the event.
- If the event publishes first but the database transaction rolls back, downstream services act on phantom data.

The HVAC ERP solves this by enforcing the **Transactional Outbox Pattern** across all state-changing operations.

---

## 2. Atomicity Inside MongoDB Transactions (Blueprint v2.0 Section 27)

Every command that updates domain state executes within a single MongoDB ACID session:

```ts
await withTransaction(async (session) => {
  // 1. Mutate domain entity
  const order = await SalesOrderModel.create([orderData], { session });

  // 2. Insert outbox event in the SAME transaction
  await OutboxRepository.createEvent({
    eventType: 'sales.order.created.v1',
    routingKey: 'sales.order.created.v1',
    aggregateType: 'SalesOrder',
    aggregateId: order[0].orderId,
    companyId: orderData.companyId,
    payload: order[0].toObject(),
    metadata: { correlationId },
  }, session);

  // 3. Commit session atomically
});
```

---

## 3. Outbox Event Schema (`outbox_events`)

```ts
interface OutboxEventDocument {
  eventId: string;          // Unique event UUID
  eventType: string;        // e.g. 'inventory.stock.deducted.v1'
  eventVersion: number;     // Schema version
  routingKey: string;       // Target RabbitMQ routing key
  aggregateType: string;    // Root aggregate name
  aggregateId: string;      // Aggregate ID
  companyId: string;        // Tenant isolation
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. Background Outbox Publisher & Worker Loop

A background worker (or BullMQ job `outbox-publisher`) continuously drains pending events:

1. **Lease Acquisition**:
   - Queries `outbox_events` for `status: 'PENDING'` ordered by `createdAt ASC` with a batch limit (e.g. 50).
   - Atomically updates status to `'PUBLISHING'` with a timestamp lease to prevent worker contention.
2. **Publishing to RabbitMQ**:
   - Publishes event payload to exchange `hvac.events.topic` with `deliveryMode: 2` (Persistent) and mandatory confirmation.
3. **Publisher Confirmation**:
   - Upon receiving the `basic.ack` confirm from RabbitMQ, the worker marks the outbox event as `'PUBLISHED'` and records `publishedAt`.
4. **Retry & Backoff**:
   - If broker connection fails, the event status reverts to `'PENDING'` with incremented `retryCount`.
   - After maximum attempts (default: 5), it transitions to `'FAILED'` for manual investigation.

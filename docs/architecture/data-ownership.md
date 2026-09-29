# Data Ownership, Boundaries & Snapshot Integrity

## 1. Database-Per-Service Architecture (Blueprint v2.0 Section 4)

To prevent distributed coupling and ensure failure isolation, each microservice owns exactly one logical database:

```text
hvac_identity
hvac_inventory
hvac_purchasing
hvac_customers
hvac_sales
hvac_installments
hvac_finance
hvac_technicians
hvac_service_operations
hvac_approvals
hvac_notifications
hvac_audit
hvac_reporting
```

### Strict Ownership Invariants
1. **No Shared Collections**: A collection belongs exclusively to its owning microservice.
2. **No Cross-Service Mongoose `ref`**: Foreign entity references are strictly stored as primitive strings (e.g., `customerId: string`, `productId: string`).
3. **No Direct Cross-Database Queries**: Joining collections across logical databases using `$lookup` is architecturally forbidden.

---

## 2. Historical Snapshot Strategy (Blueprint v2.0 Section 13)

In an ERP system, master data changes over time (e.g., a product's price increases, a customer changes their tax number, or an employee changes branches). 

To ensure **absolute historical integrity**, transactional documents store self-contained master data snapshots at the moment of transaction creation:

```ts
interface SalesLineSnapshot {
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  brandNameSnapshot: string;
  modelSnapshot?: string;
  unitCostSnapshot: mongoose.Types.Decimal128;
  unitSalePriceSnapshot: mongoose.Types.Decimal128;
  discountSnapshot: mongoose.Types.Decimal128;
  taxSnapshot: mongoose.Types.Decimal128;
  quantity: number;
  serialNumbers: string[];
}
```

### Benefits
- **Audit Defensibility**: Even if a product name or unit price is modified in the inventory catalog 3 years later, past sales orders, invoices, and accounting entries retain the exact historical values.
- **Reporting Stability**: P&L and gross profit recalculations remain deterministic forever.

---

## 3. Immutability of Financial and Stock Ledgers (Blueprint v2.0 Section 14 & 18)

- **Stock Movements (`stock_movements`)**: Immutable write-only inventory ledger. Stock balances are operational projections.
- **Journal Entries (`journal_entries`)**: Immutable accounting ledger. Direct SQL/MongoDB `UPDATE` or `DELETE` on posted journal entries is forbidden.
- **Corrections & Adjustments**: Any modification to a posted transaction requires an explicit **Reversal Transaction** (`reversal_records`) linked to the original entry (`originalTransactionId`).

# Financial Engine, Double-Entry Accounting & Ledgers

## 1. Zero-Drift Financial Mathematics (Blueprint v2.0 Section 12)

Financial correctness is the highest architectural priority. Under no circumstances may financial balances, invoice calculations, or journal entries use native JavaScript floating-point numbers (`number`).

### Precision Rules
- **Database Representation**: Stored exclusively as `mongoose.Schema.Types.Decimal128`.
- **In-Memory Calculations**: Computed exclusively using `@hvac/money` (backed by `Dinero.js` and `Decimal.js`).
- **Rounding Rule**: Standard Banker's Rounding (Half to Even) or exact two-decimal roundings (`toFixed(2)`).
- **Zero Frontend Authority**: All totals, discounts, taxes, and net balances are strictly recalculated and verified on the backend.

---

## 2. Double-Entry Accounting Core Invariant (Blueprint v2.0 Section 18)

Every accounting transaction posted to the General Ledger creates a `JournalEntry` containing two or more `JournalLine` entries.

### Mandatory Validation Rule
```text
Total Debit Amount == Total Credit Amount
```
If `Sum(Debits) - Sum(Credits) != 0.00`, the transaction is strictly rejected with a `ValidationError` before touching the database.

---

## 3. Chart of Accounts (COA) Structure (Blueprint v2.0 Section 19)

The ERP implements a standard 6-category root Chart of Accounts, extensible per tenant company:

| Code Range | Root Account Type | Normal Balance | Description |
|:---:|:---|:---:|:---|
| `1000 - 1999` | **Assets** | Debit | Cash, Banks, Accounts Receivable, Inventory, Equipment. |
| `2000 - 2999` | **Liabilities** | Credit | Accounts Payable, Supplier Dues, Deferred Revenue. |
| `3000 - 3999` | **Equity** | Credit | Owner Capital, Retained Earnings, Current Period Profit. |
| `4000 - 4999` | **Revenue** | Credit | HVAC Sales Revenue, Installation Fees, Maintenance Revenue. |
| `5000 - 5999` | **Cost of Goods Sold (COGS)**| Debit | Equipment Cost, Spare Parts Cost, Direct Labor Cost. |
| `6000 - 6999` | **Operating Expenses** | Debit | Branch Rent, Utilities, Technician Fuel, Marketing, Admin. |

---

## 4. Ledger Architecture: Truth vs. Projections

```text
 ┌────────────────────────────────────────────────────────┐
 │        JournalEntry (Accounting Source of Truth)        │
 │              Total Debits == Total Credits             │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │     TreasuryLedgerEntry (Cash & Bank Movement Truth)    │
 │              Append-Only Sequential Ledger             │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │     TreasuryBalance (Operational Balance Projection)    │
 │       Current Available Cash per Safe / Bank Account   │
 └────────────────────────────────────────────────────────┘
```

- **No Direct Balance Editing**: No public API endpoint may directly set or overwrite `TreasuryBalance`. Balance updates occur strictly via appended `TreasuryLedgerEntry` records inside MongoDB transactions.
- **Financial Period Locking (`financial_periods`)**: When a month or quarter is closed by management, its status is set to `LOCKED`. Any attempt to post retroactive journal entries against a locked period returns `422 PERIOD_LOCKED`.
- **Daily Safe Closing (`daily_closings`)**: Branch cashiers record physical cash count at end-of-day. The system computes expected cash vs. physical count and logs any cash surplus or deficit.

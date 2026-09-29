# Installment Sale Saga V2 — Orchestration & Credit Safeguards

## 1. Overview & Workflow (Blueprint v2.0 Section 32)

An Installment Sale coordinates Customer, Sales, Inventory, Installment, and Finance services to safely issue long-term consumer or commercial equipment credit.

The Saga guarantees that stock is not released and accounts receivable are not recognized until customer creditworthiness is verified and the contract schedule is durably committed.

---

## 2. Forward Step-by-Step Flow

```text
 1. Customer Service:    Verify active profile, KYC, and credit limit compliance.
 2. Sales Service:       Create Installment SalesOrder in PENDING status.
 3. Inventory Service:   Reserve specific equipment serial numbers and units.
 4. Installment Service: Create Installment Contract & generate monthly amortization schedule.
 5. Finance Service:     Collect Down Payment (if required) and post to treasury ledger.
 6. Sales Service:       Create Draft Commercial Invoice Document.
 7. Inventory Service:   Confirm equipment dispatch, mark serials SOLD, deduct stock.
 8. Finance Service:     Post General Ledger Invoice: Credit Revenue / Debit Accounts Receivable.
 9. Sales Service:       Complete SalesOrder and emit 'sales.sale.completed.v1'.
```

---

## 3. Compensation & Reversal Matrix

| Failing Step | Compensating Actions Executed |
|:---|:---|
| **Step 3 (Stock Reservation)** | Cancel SalesOrder. |
| **Step 4 (Contract Generation)**| Release Inventory Reservation $\to$ Cancel SalesOrder. |
| **Step 5 (Down Payment)** | Void Contract & Schedule $\to$ Release Inventory Reservation $\to$ Cancel SalesOrder. |
| **Step 7 (Stock Deduction)** | Reverse Down Payment $\to$ Void Contract $\to$ Release Reservation $\to$ Cancel Order. |
| **Step 8 (Accounting Post)** | Restore Stock & Serials $\to$ Reverse Down Payment $\to$ Void Contract $\to$ Cancel Order. |

---

## 4. Rescheduling & Early Settlement

- **Rescheduling**: Modifies remaining unpaid installments without deleting past payment audit records (`installment_reschedules`).
- **Early Settlement**: Applies configurable rebate discounts on unearned interest, updates contract status to `SETTLED`, and posts corresponding revenue adjustments.

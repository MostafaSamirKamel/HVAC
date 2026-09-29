# Domain Event Catalog & Contract Specifications

## 1. Domain Event Envelope (Blueprint v2.0 Section 24)

All domain events emitted across the HVAC ERP conform to a standard, typed JSON envelope:

```ts
interface DomainEvent<T> {
  eventId: string;          // UUIDv4 uniquely identifying this event instance
  eventType: string;        // Dot-separated event identifier (e.g. 'sales.order.created.v1')
  eventVersion: number;     // Integer schema version (Default: 1)
  aggregateType: string;    // Name of root aggregate (e.g. 'SalesOrder', 'StockMovement')
  aggregateId: string;      // Identifier of the modified aggregate
  timestamp: string;        // ISO-8601 UTC timestamp of creation
  correlationId: string;    // Distributed trace correlation identifier
  causationId?: string;     // ID of command or event that caused this event
  companyId: string;        // Tenant identifier for strict scoping
  branchId?: string;        // Optional branch scope
  actor: {
    userId: string;         // User or system worker executing the action
    roles?: string[];       // Snapshot of actor roles
  };
  payload: T;               // Strongly-typed event payload
}
```

---

## 2. Complete Domain Event Registry (Blueprint v2.0 Section 25)

### 2.1 Inventory & Warehouse Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `inventory.stock.reserved.v1` | `StockReservation` | Stock/serials temporarily held for an unfulfilled sales order. |
| `inventory.stock.released.v1` | `StockReservation` | Reservation released due to order cancellation or timeout. |
| `inventory.stock.deducted.v1` | `StockMovement` | Physical stock permanently decremented on delivery or issue. |
| `inventory.transfer.shipped.v1`| `WarehouseTransfer`| Stock departed source warehouse; marked as in-transit. |
| `inventory.transfer.received.v1`| `WarehouseTransfer`| Stock arrived and verified at destination warehouse. |
| `inventory.adjustment.posted.v1`| `InventoryAdjustment`| Discrepancy from physical cycle count posted. |

### 2.2 Sales & Order Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `sales.order.created.v1` | `SalesOrder` | New quotation converted or sales order placed. |
| `sales.order.confirmed.v1` | `SalesOrder` | Payment confirmed and order ready for fulfillment. |
| `sales.order.cancelled.v1` | `SalesOrder` | Order cancelled; triggers compensating release steps. |
| `sales.delivery.completed.v1` | `DeliveryOrder` | Physical goods handed over to customer. |
| `sales.invoice.created.v1` | `SalesInvoice` | Commercial invoice issued; triggers accounting post. |
| `sales.return.created.v1` | `SalesReturn` | Customer returned equipment or spare parts. |

### 2.3 Purchasing Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `purchasing.po.created.v1` | `PurchaseOrder` | Purchase order approved and dispatched to supplier. |
| `purchasing.goods.received.v1` | `GoodsReceipt` | Goods receipt note (GRN) verified at receiving dock. |
| `purchasing.bill.created.v1` | `VendorBill` | Supplier invoice registered; triggers accounts payable entry. |

### 2.4 Finance & Accounting Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `finance.invoice.posted.v1` | `JournalEntry` | General ledger entries posted for customer invoice. |
| `finance.payment.received.v1` | `Payment` | Cash/bank collection posted against receivables. |
| `finance.payment.reversed.v1` | `Payment` | Payment reversed; restores outstanding balance. |
| `finance.daily.closed.v1` | `DailyClosing` | Branch cashier safe reconciled and closed for day. |
| `finance.period.reopened.v1` | `FinancialPeriod` | Locked accounting period reopened by executive audit. |

### 2.5 Installment Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `installments.contract.created.v1`| `InstallmentContract`| Installment contract signed and schedule generated. |
| `installments.payment.applied.v1` | `InstallmentSchedule`| Customer installment paid and allocated. |
| `installments.installment.overdue.v1`| `InstallmentSchedule`| Schedule passed due date; triggers delinquency alerts. |

### 2.6 Technician & Service Operations Events
| Routing Key | Aggregate | Trigger Condition |
|:---|:---|:---|
| `technician.settlement.done.v1` | `Settlement` | Technician van stock and cash custody cleared. |
| `service.ticket.created.v1` | `ServiceTicket` | Customer maintenance complaint logged. |
| `service.workorder.assigned.v1` | `WorkOrder` | Work order scheduled to field technician. |
| `service.workorder.completed.v1` | `WorkOrder` | Maintenance/installation signed off by customer. |

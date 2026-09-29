HVAC ERP

SRS

Software Requirements Specification

نظام ERP متعدد الفروع لإدارة شركة تكييف

الإصدار 1.1 \| Draft for Review

يغطي: الفروع • المخازن • المبيعات • التقسيط • الحسابات • الفنيين • الصيانة • التقارير

| البند    | التفاصيل                   |
|---------------------------------|---------------------------------------------------|
| System   | HVAC ERP Management System |
| Version  | V1.1                       |
| Based On | PRD V1.1                   |
| Status   | Draft for Review           |

# المحتويات

1. Architecture

2. Suggested Technology

3. Multi-Branch Support

4. Authentication

5. RBAC Authorization

6. Main Entities

7. Financial Engine

8. Financial Entry

9. Accounting Layer

10. Chart of Accounts

11. Revenue Recognition

12. COGS

13. Gross Profit

14. Net Profit

15. Profit & Loss

16. Cash Flow

17. Treasury

18. Treasury Ledger

19. Bank Accounts

20. Internal Transfers

21. Receivables Engine

22. Payables Engine

23. Supplier Ledger

24. Customer Ledger

25. Dashboard Summary

26. Dashboard Filters

27. Drill-Down

28. Expense Management

29. Expense Categories

30. Inventory Valuation

31. Branch Financial Performance

32. Daily Closing

33. Closing Validation

34. Period Lock

35. Financial Adjustments

36. Products

37. Serial Numbers

38. Inventory Engine

39. Warehouse Transfer

40. Purchasing

41. Sales

42. Installments

43. Payment Allocation

44. Technicians

45. Technician Custody

46. Warranty

47. Approval Engine

48. Audit

49. Soft Delete

50. Reversal

51. Concurrency

52. Database Transactions

53. Performance

54. Search

55. Reports API

56. Exports

57. Security

58. Backups

59. Finance Acceptance Criteria

60. System-Wide Acceptance Criteria

61. Business Rules Still TBD

# 1. Architecture

- النظام Web-Based Multi-Branch ERP.
- Frontend ↔ REST API ↔ Backend Services ↔ PostgreSQL ↔ Storage / Notifications / Cache.
- يجب أن تكون المعمارية Modular وقابلة لإضافة Modules مستقبلية.

# 2. Suggested Technology

- Frontend: React / Next.js.
- Backend: Node.js / NestJS أو ما يعادله.
- Database: PostgreSQL.
- Cache: Redis عند الحاجة.
- File Storage: Object Storage.

# 3. Multi-Branch Support

- الكيانات التشغيلية تحتوي حسب الحاجة على company_id / branch_id / warehouse_id / treasury_id.
- يتم تطبيق Data Scope والتحقق من الصلاحيات على Backend.

# 4. Authentication

- Username/Email + Password، Secure Hashing، Session/JWT، Password Reset، Logout، Session Expiration، Disable User.

# 5. RBAC Authorization

- Permission Model: resource / action / scope.
- Actions: view / create / edit / approve / cancel / export / print.
- Scopes: own / branch / selected_branches / company.

# 6. Main Entities

- Company، Branch، Warehouse، StockLocation، Treasury، BankAccount، User، Role، Permission، Employee، Supplier، Customer، Product، Brand، Category، SerialNumber، PurchaseOrder، GoodsReceipt، VendorInvoice، SupplierPayment، SupplierLedgerEntry، SalesOrder، SalesInvoice، CustomerPayment، InstallmentContract، InstallmentSchedule، StockMovement، WarehouseTransfer، Expense، CashTransfer، FinancialEntry، JournalEntry، Account، Technician، ServiceTicket، WorkOrder، Warranty، SparePartUsage، ReturnOrder، ApprovalRequest، Attachment، Notification، AuditLog، DailyClosing.

# 7. Financial Engine

- يجب إنشاء Financial Engine مركزي.
- لا يتم حساب Dashboard من أرقام تُدخل يدويًا.
- كل Transaction تشغيلية مثل Sale / Payment / Purchase / Supplier Payment / Expense / Refund / Installment Collection / Cash Transfer تنشئ أثرًا ماليًا مناسبًا.

# 8. Financial Entry

- الكيان financial_entry يحتوي: id، company_id، branch_id، entry_date، entry_type، reference_type، reference_id، amount، direction، treasury_id، bank_account_id، customer_id، supplier_id، created_by، status.
- direction: IN / OUT / INTERNAL.

# 9. Accounting Layer

- يفضل تصميم النظام قابلًا لإضافة Double-Entry Accounting.
- Journal Lines: account_id / debit / credit / partner_id / branch_id / reference.
- يجب دائمًا أن Total Debit = Total Credit.

# 10. Chart of Accounts

- Structure مقترح: Assets / Liabilities / Equity / Revenue / Cost of Goods Sold / Expenses مع Accounts فرعية.

# 11. Revenue Recognition

- Sales Revenue يُحتسب من العمليات المعتمدة وليس من التحصيل فقط.
- Cash Collection هو Cash Movement وليس Revenue جديدًا إذا كانت الفاتورة مسجلة مسبقًا.

# 12. COGS

- عند بيع المنتج يجب معرفة Cost Basis.
- Costing Method: FIFO أو Weighted Average — TBD.
- COGS يستخدم في حساب Gross Profit.

# 13. Gross Profit

- Formula: Net Sales − COGS = Gross Profit.
- API: GET /finance/gross-profit.
- Filters: branch_id / date_from / date_to / product_id / brand_id / salesperson_id.

# 14. Net Profit

- Formula: Gross Profit − Operating Expenses ± Adjustments = Net Profit.
- API: GET /finance/net-profit.

# 15. Profit & Loss

- Endpoint: GET /finance/profit-loss.
- Response: revenue / cogs / gross_profit / expense_categories / total_expenses / net_profit.
- Filters: Company / Branch / Date Range.

# 16. Cash Flow

- Endpoint: GET /finance/cash-flow.
- Groups: Operating Cash In / Operating Cash Out / Financing-Owner Entries إن وجدت / Net Cash Flow.
- Internal Transfer لا يعتبر Cash Flow للشركة كلها لكنه يظهر في Cashbox Movement.

# 17. Treasury

- Fields: id / branch_id / name / type / opening_balance / active.
- الرصيد الحالي لا يعدل يدويًا إلا عبر Opening أو Adjustment بصلاحية.

# 18. Treasury Ledger

- كل حركة: treasury_id / date / reference / type / in_amount / out_amount / running_balance.
- Types: SALE / COLLECTION / EXPENSE / SUPPLIER_PAYMENT / TRANSFER_IN / TRANSFER_OUT / REFUND / ADJUSTMENT.

# 19. Bank Accounts

- BankAccount: bank_name / account_name / account_number_reference / branch_id nullable / currency / active.
- ترتبط المدفوعات والحركات البنكية بالحساب.

# 20. Internal Transfers

- Cash/Bank Transfer عملية Atomic: Source Entry + Destination Entry داخل Database Transaction واحدة.
- States: Draft / Pending Approval / Approved / Sent / Received / Completed / Cancelled.

# 21. Receivables Engine

- Customer Invoices − Customer Payments − Credits − Returns.
- Aging: Current / 1–30 / 31–60 / 61–90 / 90+.
- Endpoint: GET /finance/receivables.

# 22. Payables Engine

- Vendor Bills − Supplier Payments − Credits − Returns.
- يعرض Aging.
- Endpoint: GET /finance/payables.

# 23. Supplier Ledger

- Entry Types: PURCHASE_INVOICE / PAYMENT / ADVANCE_PAYMENT / PURCHASE_RETURN / ADJUSTMENT.
- يدعم Supplier Credit.

# 24. Customer Ledger

- Entry Types: SALE_INVOICE / PAYMENT / INSTALLMENT / RETURN / REFUND / CREDIT / ADJUSTMENT.
- يجب توفير Running Balance.

# 25. Dashboard Summary

- Endpoint: GET /finance/dashboard.
- Response: cash_balance / bank_balance / sales / collections / purchases / expenses / receivables / payables / gross_profit / net_profit / inventory_value / outstanding_installments / supplier_balance / customer_balance / cash_flow.

# 26. Dashboard Filters

- date_from / date_to / branch_id / warehouse_id / salesperson_id / product_id / brand_id.

# 27. Drill-Down

- كل KPI يعيد summary_value / drilldown_endpoint / filters.
- مثال: الضغط على expenses يفتح GET /finance/expenses بالفلاتر الحالية.

# 28. Expense Management

- Fields: id / branch_id / category_id / amount / date / payment_source_type / treasury_id / bank_id / employee_id / description / attachment / approval_status.

# 29. Expense Categories

- Hierarchical Categories مثل Operating Expenses → Rent / Electricity / Fuel / Transport / Maintenance / Marketing.

# 30. Inventory Valuation

- Endpoint: GET /finance/inventory-valuation.
- Filters: branch / warehouse / brand / product.
- القيمة = available_quantity × applicable_cost وفق Costing Method.

# 31. Branch Financial Performance

- Endpoint: GET /finance/branch-performance.
- لكل Branch: sales / collections / expenses / gross_profit / net_profit / receivables / payables / cash / inventory_value.

# 32. Daily Closing

- Fields: branch_id / date / opening_balance / cash_in / cash_out / transfers_in / transfers_out / expected_closing / actual_closing / difference / closed_by / approved_by / status.

# 33. Closing Validation

- لا يمكن تعديل عمليات يوم مغلق إلا بصلاحية Reopen Period.
- كل Reopen يُسجل في Audit Log.

# 34. Period Lock

- يدعم Open Period / Closed Period / Locked Period لمنع تعديل الفترات المالية السابقة.

# 35. Financial Adjustments

- كل Adjustment يحتوي reason / created_by / approved_by / reference / before_value / after_value.
- لا يسمح باستخدام Adjustment لتجاوز الـworkflow الطبيعي بدون Permission.

# 36. Products

- Product fields: sku / barcode / name / brand_id / model / category_id / capacity / purchase_cost / retail_price / commercial_price / minimum_stock / serial_tracking / active.

# 37. Serial Numbers

- Serial Unique.
- Status: IN_STOCK / RESERVED / IN_TRANSIT / SOLD / INSTALLED / RETURNED / DAMAGED / SUPPLIER_RETURN.

# 38. Inventory Engine

- كل تعديل يتم من خلال StockMovement ولا يسمح بتعديل Quantity مباشرة.

# 39. Warehouse Transfer

- Create → Validate → Reserve → Approval → Ship → Transit → Receive → Complete.
- لا يجوز تنفيذ Receive مرتين أو استلام تحويل ملغي.

# 40. Purchasing

- PO → Receipt → Vendor Invoice → Payment.
- Goods Receipt ينشئ Stock Movement ويتحقق أو ينشئ Serial Numbers.

# 41. Sales

- Sale Types: CASH / INSTALLMENT / COMMERCIAL.
- Delivery يتحقق من Stock وSerial Availability قبل التنفيذ.

# 42. Installments

- InstallmentContract: total / down_payment / financed_amount / number_of_installments / start_date / status.
- Schedule: due_date / amount / paid / remaining / status.

# 43. Payment Allocation

- الدفع يمكن توزيعه على Invoice واحدة أو عدة Invoices أو Installments أو الاحتفاظ به Credit Balance.

# 44. Technicians

- الفني يرى فقط المهام المسندة إليه حسب Permission.
- يمكنه Start، Update Status، Use Parts، Add Expense، Collect Money، Add Notes، Upload Photos، Complete.

# 45. Technician Custody

- Collection ينشئ Custody Entry.
- Approved Expense يخصم من العهدة.
- Settlement يغلق العهدة جزئيًا أو كليًا.

# 46. Warranty

- Warranty: serial_id / customer_id / start_date / end_date / status / coverage.

# 47. Approval Engine

- Generic Approval Engine: request_type / reference_type / reference_id / requested_by / approver / status / approved_at / rejection_reason.

# 48. Audit

- Audit Log إلزامي: user / entity / action / old_value / new_value / timestamp / ip / device.

# 49. Soft Delete

- العمليات المالية لا تستخدم Hard Delete؛ تستخدم cancelled / inactive / reversed مع Reverse Entry عند الحاجة.

# 50. Reversal

- إلغاء Financial Transaction بعد الاعتماد يتم بواسطة Reverse Transaction قدر الإمكان، وليس حذف السجل.

# 51. Concurrency

- حماية Serial Sales / Stock Reservation / Payments / Cash Transfer / Warehouse Receipt من Race Conditions.

# 52. Database Transactions

- تستخدم في Sale + Delivery، Purchase Receipt، Payment، Cash Transfer، Stock Transfer، Refund، Installment Collection، Technician Settlement.

# 53. Performance

- Pagination / Indexes / Server-side Filters / Aggregation Queries / Caching عند الحاجة.
- ممنوع تحميل كل الحركات المالية إلى Frontend لحساب Dashboard.

# 54. Search

- Global Search: Customer / Phone / Supplier / Invoice / Serial / Product / Work Order / Installment / Payment Receipt.

# 55. Reports API

- /reports/sales، /reports/purchases، /reports/inventory، /reports/supplier-statement، /reports/customer-statement، /reports/installments، /reports/expenses، /reports/treasury، /reports/profit-loss، /reports/cash-flow، /reports/receivables، /reports/payables، /reports/inventory-valuation، /reports/branch-performance.

# 56. Exports

- PDF / Excel مع Permission مستقل للتصدير.

# 57. Security

- HTTPS، Password Hashing، Backend Authorization، Rate Limiting، SQL Injection Protection، XSS Protection، Secure File Upload، Session Revocation، Audit Logging، Data Scope Validation.

# 58. Backups

- Daily Backup، Periodic Full Backup، Restore Testing.
- Retention: TBD.

# 59. Finance Acceptance Criteria

- المدير يستطيع رؤية أرصدة الخزن والبنوك، المستحقات، الالتزامات، مديونية الموردين والعملاء، الأقساط المتأخرة، المبيعات، المشتريات، المصروفات، Gross Profit، Net Profit، P&L، Cash Flow، قيمة المخزون، مقارنة الفروع، Drill-Down لأي KPI، وكل Cash In/Cash Out ومن نفذ العملية.
- التحويل الداخلي لا يزيد أو يقلل أرباح الشركة.

# 60. System-Wide Acceptance Criteria

- يمكن إنشاء الفروع والمخازن والخزن والمستخدمين والصلاحيات.
- يمكن تسجيل الموردين والمشتريات واستلام الأجهزة وتتبع الـSerial وتحويل المخزون.
- يمكن تسجيل العملاء والبيع Cash / Installment / Commercial والتحصيل وإدارة الموردين والعملاء ماليًا.
- يمكن تحويل الأموال بين الفروع وتسجيل المصروفات ومعرفة الربح والخسارة.
- يمكن إدارة الفنيين والأعطال والتركيبات والضمان والتقارير والـAudit Log.

# 61. Business Rules Still TBD

- Costing Method: FIFO / Average.
- Tax/VAT Policy.
- Warranty Start Rule.
- Commercial Sales Policy.
- Installment Late Fees.
- Discount Approval Limits.
- Refund Rules.
- Cash Transfer Approval Limits.
- Stock Transfer Approval Limits.
- Accounting Period Closing Rules.
- Payroll Scope.
- Cheques.
- Bank Reconciliation.
- Owner Capital Transactions.
- Depreciation / Fixed Assets.
- Exact accounting level required for Phase 1.

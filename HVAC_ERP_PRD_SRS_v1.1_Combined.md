HVAC ERP

PRD + SRS

Product & Software Requirements Specification

نظام ERP متعدد الفروع لإدارة شركة تكييف

الإصدار 1.1 \| Draft for Review

يغطي: الفروع • المخازن • المبيعات • التقسيط • الحسابات • الفنيين • الصيانة • التقارير

| البند      | التفاصيل                   |
|-----------------------------------|---------------------------------------------------|
| اسم النظام | HVAC ERP Management System |
| نوع النظام | Multi-Branch ERP           |
| PRD        | V1.1                       |
| SRS        | V1.1                       |
| الحالة     | Draft for Review           |

# الجزء الأول — PRD

# محتويات PRD

1. نظرة عامة على المنتج

2. أهداف المنتج

3. الهيكل التنظيمي

4. المستخدمون والصلاحيات

5. المنتجات

6. تتبع Serial Number

7. الموردون

8. المشتريات

9. المخزون

10. تحويلات المخزون

11. الجرد

12. العملاء

13. المبيعات

14. البيع الكاش

15. البيع بالتقسيط

16. البيع التجاري

17. التحصيل

18. الخزن

19. التحويل بين الخزن والفروع

20. المصروفات

21. Finance & Accounting Control Center

22. Financial Overview

23. Cash Position

24. Receivables

25. Payables

26. Financial Transactions

27. Supplier Financials

28. Customer Financials

29. Gross Profit

30. Net Profit

31. Profit & Loss Statement

32. Cash Flow

33. Branch Financial Performance

34. Drill-Down

35. Inventory Valuation

36. Financial Dashboard

37. Financial Charts

38. Daily Closing

39. التركيبات

40. الشكاوى والأعطال

41. بوابة الفني

42. عهد الفنيين

43. قطع الغيار

44. الضمان

45. المرتجعات والاستبدال

46. الموافقات

47. Audit Log

48. الإشعارات

49. التقارير

50. نطاق MVP ومعايير النجاح

# 1. نظرة عامة على المنتج

- النظام عبارة عن منصة ERP متكاملة لإدارة شركة تعمل في بيع وتركيب وصيانة أجهزة التكييف، مع دعم عدة فروع وعدة مخازن وخزن داخل كل فرع.
- يغطي النظام دورة العمل كاملة من المورد والمشتريات والمخزون وحتى البيع والتحصيل والحسابات والتركيب والصيانة والتقارير.
- يستخدم Odoo كمرجع لفلسفة ERP والـworkflows فقط، بينما يتم تخصيص المنتج بالكامل لاحتياجات شركة التكييف.

# 2. أهداف المنتج

- إدارة جميع الفروع مركزيًا.
- إدارة الموظفين والصلاحيات.
- تتبع المنتجات والأجهزة بالـSerial Number.
- إدارة الموردين والمشتريات والمديونيات.
- إدارة المخزون والجرد والتحويلات.
- إدارة العملاء والمبيعات الكاش والتقسيط والتجاري.
- إدارة التحصيل والخزن والبنوك والتحويلات بين الفروع.
- إدارة الحسابات والأرباح والخسائر والتدفقات النقدية.
- إدارة الفنيين والتركيبات والأعطال والضمان وقطع الغيار.
- توفير تقارير لحظية وAudit Log كامل.

# 3. الهيكل التنظيمي

- Company → Branches → Warehouses → Treasuries → Employees.
- يمكن لكل فرع امتلاك عدد غير محدود من المخازن والخزن.
- يمكن ربط الموظفين والصلاحيات بفرع واحد أو عدة فروع أو الشركة بالكامل.

# 4. المستخدمون والصلاحيات

- أدوار مقترحة: Super Admin، General Manager، Branch Manager، Accountant، Cashier، Sales، Warehouse Manager، Collection، Customer Service، Technical Supervisor، Technician.
- الصلاحيات الأساسية: View / Create / Edit / Cancel / Approve / Export / Print.
- نطاق الصلاحية: Own / Branch / Selected Branches / Company.

# 5. المنتجات

- الاسم، الماركة، الموديل، التصنيف، القدرة، بارد فقط أو ساخن وبارد، Inverter أو Normal، SKU، Barcode، تكلفة الشراء، أسعار البيع، مدة الضمان، الحد الأدنى للمخزون، وتفعيل Serial Tracking.
- يدعم النظام أكثر من Pricelist مثل Retail / Commercial / Distributor.

# 6. تتبع Serial Number

- يجب معرفة التاريخ الكامل لكل جهاز: شراء → استلام → مخزن → تحويل → حجز → بيع → تركيب → ضمان → شكوى → صيانة → مرتجع.
- صفحة الـSerial تعرض المورد، فاتورة الشراء، المخزن الحالي، العميل، الفاتورة، التركيب، الضمان، الأعطال وقطع الغيار.

# 7. الموردون

- ملف المورد يشمل البيانات الأساسية، المشتريات، المدفوعات، المرتجعات، الدفعات المقدمة، الخصومات، التسويات والرصيد الحالي.
- إذا كانت المشتريات 1,000,000 والمدفوع 500,000: علينا للمورد 500,000.
- إذا كانت المشتريات 1,000,000 والمدفوع 1,500,000: لنا عند المورد 500,000 كرصيد دائن.
- يدعم Supplier Credit وAdvance Payment وتوزيع الدفعة لاحقًا على فاتورة أو أكثر.

# 8. المشتريات

- Purchase Request / RFQ → Purchase Order → Goods Receipt → Vendor Invoice → Payment.
- تتضمن العملية المورد، الأصناف، الكميات، التكلفة، الخصومات، الضرائب إن وجدت، المخزن، Serial Numbers، المدفوع والمتبقي وتاريخ الاستحقاق.

# 9. المخزون

- لكل مخزن رصيد مستقل: On Hand / Available / Reserved / In Transit / Damaged.
- لا يسمح ببيع أو تحويل كمية أكبر من المتاح.
- يدعم المخزن منتجات أجهزة وقطع غيار وخامات.

# 10. تحويلات المخزون

- يدعم التحويل بين مخزنين داخل نفس الفرع أو بين فروع مختلفة.
- الحالات: Draft → Pending Approval → Approved → Shipped → In Transit → Received → Completed.
- التحويل لا يعتبر بيعًا أو شراءً ولا يغير إجمالي مخزون الشركة.

# 11. الجرد

- جرد دوري أو مفاجئ، Physical Count، عجز، زيادة، Stock Adjustment.
- التسويات الحساسة تخضع لصلاحية وموافقة وتظهر في Audit Log.

# 12. العملاء

- ملف العميل موحد ويشمل البيانات، الهواتف، العناوين، نوع العميل، المبيعات، المدفوعات، الرصيد، الأقساط، الأجهزة والـSerials، التركيبات، الشكاوى والصيانة والمرتجعات.

# 13. المبيعات

- أنواع البيع: Cash / Installment / Commercial.
- Quotation → Sales Order → Stock Reservation → Delivery → Invoice → Payment → Installation عند الحاجة.

# 14. البيع الكاش

- تسجيل العميل، المنتج، Serial، السعر، الخصم، الموظف، طريقة الدفع، الخزنة أو البنك والتحصيل.

# 15. البيع بالتقسيط

- العقد يحتوي إجمالي البيع، المقدم، المتبقي، عدد الأقساط، قيمة القسط، تاريخ البداية وجدول الاستحقاق.
- حالات القسط: Upcoming / Due / Partial / Paid / Overdue.
- إعادة الجدولة تحتاج Approval وتحفظ التاريخ السابق.

# 16. البيع التجاري

- يدعم Commercial Customer، Pricelist، Credit Limit، Payment Terms، Customer Ledger وDeferred Payment.
- السياسات التفصيلية للبيع التجاري: TBD.

# 17. التحصيل

- كل تحصيل يسجل العميل، القيمة، نوع التحصيل، الموظف، الفرع، الخزنة، طريقة الدفع، التاريخ والمرجع، وينشئ Receipt Number.

# 18. الخزن

- يمكن إنشاء عدة خزن لكل فرع مثل Main Cash / Sales Cash / Collection Cash / Petty Cash.
- لكل خزنة Ledger مستقل.

# 19. التحويل بين الخزن والفروع

- يدعم خزنة → خزنة، فرع → فرع، خزنة → بنك، بنك → خزنة.
- التحويل الداخلي لا يعتبر Income أو Expense.
- يتم تسجيل Source، Destination، Amount، Method، Date، Created/Approved/Received By، Notes وAttachment.

# 20. المصروفات

- تصنيفات مثل الإيجار، الكهرباء، المرتبات، البنزين، النقل، التسويق، الصيانة، التشغيل، مصروفات الفنيين وغيرها.
- كل مصروف مرتبط بالفرع ومصدر الدفع والموظف والتصنيف والتاريخ.

# 21. Finance & Accounting Control Center

- مركز مالي رئيسي يتيح للإدارة معرفة الوضع المالي للشركة بالكامل من شاشة واحدة.
- يجب أن تكون جميع أرقام الـDashboard ناتجة عن العمليات الأصلية والـLedgers، وليس أرقامًا تُدخل يدويًا.

# 22. Financial Overview

- المؤشرات: Total Sales، Total Revenue، Total Collections، Total Purchases، Total Expenses، Cash Available، Bank Balance، Receivables، Payables، Inventory Value، Gross Profit، Net Profit، Cash Flow.
- الفترات: Today / Week / Month / Year / Custom.

# 23. Cash Position

- يعرض أرصدة كل الخزن والبنوك وإجمالي السيولة الحالية للشركة مع Drill-Down إلى Ledger كل خزنة أو حساب.

# 24. Receivables

- يشمل أقساط العملاء، العملاء التجاريين والآجلين، أرصدة الشركة لدى الموردين، عهد الموظفين والفنيين وأي مستحقات أخرى.
- Aging: Current / 1–30 / 31–60 / 61–90 / 90+ days.

# 25. Payables

- يشمل الموردين، المصروفات المستحقة، المرتبات والالتزامات التشغيلية الأخرى مع Aging Report.

# 26. Financial Transactions

- صفحة موحدة لكل Cash In / Cash Out / Internal movements مع فلاتر التاريخ، الفرع، الموظف، نوع الحركة، الخزنة، البنك، العميل، المورد وطريقة الدفع.

# 27. Supplier Financials

- يعرض إجمالي المشتريات، إجمالي المدفوع، الرصيد، آخر دفعة، الفواتير المستحقة والدفعات المقدمة، مع Statement كامل لكل مورد.

# 28. Customer Financials

- يعرض إجمالي المبيعات، المدفوع، المتبقي، الأقساط، المتأخرات، الرصيد الدائن والمديونية التجارية.

# 29. Gross Profit

- Net Sales − Cost of Goods Sold = Gross Profit.
- يجب تحليل الربح حسب المنتج، Serial، الماركة، الفرع، الموظف، نوع البيع والفترة.

# 30. Net Profit

- Gross Profit − Operating Expenses ± Adjustments = Net Profit / Loss.
- يجب عدم الخلط بين الربح والسيولة النقدية.

# 31. Profit & Loss Statement

- Revenue − COGS = Gross Profit، ثم خصم الرواتب والإيجار والمرافق والنقل والتسويق والصيانة والمصروفات التشغيلية للوصول إلى Net Profit / Net Loss.
- يمكن تشغيل التقرير للشركة أو فرع محدد أو فترة مخصصة.

# 32. Cash Flow

- Cash In: Cash Sales، Collections، Commercial Collections، Supplier Refund، Capital Injection، Other Receipts.
- Cash Out: Supplier Payments، Expenses، Refunds، Salaries، Purchases، Other Payments.
- يعرض Net Cash Flow.

# 33. Branch Financial Performance

- مقارنة الفروع من حيث Sales، Collections، Expenses، Gross Profit، Net Profit، Receivables، Inventory Value وCash Balance.

# 34. Drill-Down

- كل رقم مالي في Dashboard قابل للضغط للوصول للتصنيفات والحركات الأصلية التي كونت الرقم.

# 35. Inventory Valuation

- قيمة مخزون الشركة، كل فرع، كل مخزن وكل Brand، مع إمكانية تحديد المخزون الراكد.
- Costing Method: TBD — FIFO أو Weighted Average.

# 36. Financial Dashboard

- بطاقات: Cash Available، Bank Balance، Sales، Collections، Purchases، Expenses، Receivables، Payables، Gross Profit، Net Profit، Inventory Value، Outstanding Installments، Supplier Debt، Customer Debt.

# 37. Financial Charts

- Sales Trend، Profit Trend، Expense Trend، Cash Flow Trend، Branch Comparison، Top Expense Categories، Receivables Aging، Payables Aging.

# 38. Daily Closing

- Opening Balance + Cash In − Cash Out ± Transfers = Expected Closing.
- يدخل المستخدم Actual Closing ويحسب النظام Difference، وأي فرق يتجاوز الحد المحدد يحتاج Approval.

# 39. التركيبات

- كل تركيب Work Order مستقل مرتبط بالعميل والجهاز والـSerial والفني والموقع والموعد والخامات والمواسير والحوامل والتحصيل والمصروفات والملاحظات.

# 40. الشكاوى والأعطال

- Complaint → Ticket → Technician Assignment → Visit → Repair → Collection → Close.
- يتم ربط الشكوى بالعميل والجهاز والـSerial والضمان والأولوية والموعد.

# 41. بوابة الفني

- الفني يرى المهام المسندة إليه وبيانات العميل والعنوان والجهاز والعطل.
- الحالات: Assigned / On The Way / Started / Need Spare Part / Need Another Visit / Completed.
- عند الإنهاء يسجل التحصيل والمصروف وقطع الغيار والملاحظات والصور.

# 42. عهد الفنيين

- تحصيل الفني ومصروفاته وقطع الغيار المسلمة له تظهر في عهدته، ويتم Settlement مع خزنة الفرع.

# 43. قطع الغيار

- شراء، تخزين، تحويل، صرف للفني، استخدام في Work Order، إرجاع، وحساب تكلفة الصيانة.

# 44. الضمان

- لكل جهاز Start Date، End Date، Coverage، Serial، Customer.
- بداية الضمان من البيع أو التركيب: TBD حسب سياسة الشركة.

# 45. المرتجعات والاستبدال

- يدعم Sales Return / Purchase Return / Exchange، مع حالة الجهاز: Resellable / Inspection / Damaged / Supplier Return.

# 46. الموافقات

- Approvals للخصومات، تغيير السعر، إلغاء الفاتورة، Refund، تحويل الأموال، تحويل المخزون، Stock Adjustment، إعادة جدولة الأقساط، والتعديلات المالية.

# 47. Audit Log

- يسجل المستخدم، التاريخ، العملية، القيمة السابقة، القيمة الجديدة، المرجع وDevice/IP عند الإمكان.
- لا يتم الاعتماد على Hard Delete للعمليات المالية والمخزنية.

# 48. الإشعارات

- قسط مستحق أو متأخر، Supplier Due، Low Stock، Transfer Pending، Ticket Delayed، Technician Task، Approval Request، Treasury Difference.

# 49. التقارير

- Sales، Purchases، Inventory، Stock Movement، Serial History، Suppliers، Customers، Installments، Collections، Expenses، Treasury، Bank، P&L، Cash Flow، Receivables، Payables، Inventory Valuation، Branch Performance، Technician Performance، Maintenance، Warranty، Audit.

# 50. نطاق MVP ومعايير النجاح

- النسخة الأولى تشمل الفروع، المستخدمين، المنتجات، الموردين، المشتريات، المخزون، Serial Tracking، المبيعات، الأقساط، التحصيل، الخزن، البنوك، الحسابات، الفنيين، الصيانة، الضمان، التقارير والـAudit.
- يجب أن يستطيع المدير الإجابة من النظام: معايا كام؟ ليا كام؟ عليا كام؟ بعت بكام؟ حصّلت كام؟ اشتريت بكام؟ صرفت كام؟ كسبت أو خسرت كام؟ المخزون قيمته كام؟ كل فرع عامل إيه؟ كل جهاز موجود فين؟ ومين نفذ كل عملية؟

HVAC ERP

SRS

Software Requirements Specification

نظام ERP متعدد الفروع لإدارة شركة تكييف

الإصدار 1.1 \| Draft for Review

يغطي: الفروع • المخازن • المبيعات • التقسيط • الحسابات • الفنيين • الصيانة • التقارير

# محتويات SRS

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

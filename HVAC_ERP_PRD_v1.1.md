HVAC ERP

PRD

Product Requirements Document

نظام ERP متعدد الفروع لإدارة شركة تكييف

الإصدار 1.1 \| Draft for Review

يغطي: الفروع • المخازن • المبيعات • التقسيط • الحسابات • الفنيين • الصيانة • التقارير

| البند      | التفاصيل                   |
|-----------------------------------|---------------------------------------------------|
| اسم المنتج | HVAC ERP Management System |
| نوع النظام | Multi-Branch ERP           |
| الإصدار    | V1.1                       |
| الحالة     | Draft for Review           |

# المحتويات

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

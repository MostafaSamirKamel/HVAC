# HVAC Enterprise Resource Planning (ERP) — Frontend Integration & API Master Guide

> **Document Version:** 2.0  
> **Target Audience:** Frontend Web & Mobile Engineers  
> **Base Ingress URL (Development):** `http://localhost:3000`  
> **Base Ingress URL (Production):** `https://api.hvac-erp.com`  
> **Protocol:** RESTful JSON over HTTPS  
> **Authentication:** Bearer JWT (Access Token) + HttpOnly/Rotated Refresh Token  

---

## 📑 فهرس المحتويات (Table of Contents)

1. [نظرة عامة والاتصال بالبوابة (Overview & Gateway Architecture)](#1-نظرة-عامة-والاتصال-بالبوابة-overview--gateway-architecture)
2. [دورة حياة المصادقة والتوكنات (Authentication & Token Lifecycle)](#2-دورة-حياة-المصادقة-والتوكنات-authentication--token-lifecycle)
3. [معايير الطلبات والردود (Unified Request & Response Standards)](#3-معايير-الطلبات-والردود-unified-request--response-standards)
4. [معالجة الأخطاء وأكواد الاستجابة (Error Handling & Error Taxonomy)](#4-معالجة-الأخطاء-وأكواد-الاستجابة-error-handling--error-taxonomy)
5. [دليل مسارات الواجهات البرمجية الكامل (Exhaustive Endpoint Catalog)](#5-دليل-مسارات-الواجهات-البرمجية-الكامل-exhaustive-endpoint-catalog)
   - [5.1 الهوية والمستخدمين (Auth & Users)](#51-الهوية-والمستخدمين-auth--users)
   - [5.2 إدارة المخزون والمستودعات (Inventory & Warehouses)](#52-إدارة-المخزون-والمستودعات-inventory--warehouses)
   - [5.3 المبيعات وعروض الأسعار (Sales, Quotations & Invoices)](#53-المبيعات-وعروض-الأسعار-sales-quotations--invoices)
   - [5.4 العملاء وإدارة العلاقات (Customers & CRM)](#54-العملاء-وإدارة-العلاقات-customers--crm)
   - [5.5 المشتريات والموردين (Purchasing & Suppliers)](#55-المشتريات-والموردين-purchasing--suppliers)
   - [5.6 الأقساط وجداول الاستحقاق (Installments & Credit)](#56-الأقساط-وجداول-الاستحقاق-installments--credit)
   - [5.7 المالية والخزينة (Finance & Treasuries)](#57-المالية-والخزينة-finance--treasuries)
   - [5.8 الفنيين والعمليات الميدانية (Technicians & Van Stock)](#58-الفنيين-والعمليات-الميدانية-technicians--van-stock)
   - [5.9 أوامر الصيانة والتشغيل (Service Operations & Tickets)](#59-أوامر-الصيانة-والتشغيل-service-operations--tickets)
   - [5.10 منظومة الموافقات (Approval Engine)](#510-منظومة-الموافقات-approval-engine)
   - [5.11 الإشعارات والتنبيهات (Notifications)](#511-الإشعارات-والتنبيهات-notifications)
   - [5.12 سجل التدقيق والامتثال (Audit Logs)](#512-سجل-التدقيق-والامتثال-audit-logs)
   - [5.13 التقارير ولوحات التحكم (Reporting & Analytics)](#513-التقارير-ولوحات-التحكم-reporting--analytics)
6. [قواعد العمل الحرجة للفرونت إند (Critical Frontend Rules & Gotchas)](#6-قواعد-العمل-الحرجة-للفرونت-إند-critical-frontend-rules--gotchas)

---

## 1. نظرة عامة والاتصال بالبوابة (Overview & Gateway Architecture)

يتواصل تطبيق الـ Frontend (Web Dashboard أو Mobile App) حصرياً مع **Edge API Gateway** على المنفذ `3000`. لا يتصل الفرونت إند بأي خدمة خلفية بشكل مباشر على الإطلاق.

```text
 ┌────────────────────────────────────────────────────────┐
 │           Frontend Application (React / Next.js / Mobile)     │
 └───────────────────────────┬────────────────────────────┘
                             │ Base URL: http://localhost:3000
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │               Edge API Gateway (:3000)                 │
 │ • Reverse Proxy  • JWT Validation  • Rate Limiting     │
 └───────────────────────────┬────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
 Identity (:4001)       Inventory (:4002)       Sales (:4005) ...
```

### معلومات الاتصال الأساسية
- **Base URL المحلي**: `http://localhost:3000`
- **بادئة المسارات العامة**: `/api/v1`
- **فحص سلامة البوابة (Healthcheck)**:
  - `GET http://localhost:3000/health` $\to$ حالة البوابة
  - `GET http://localhost:3000/health/live` $\to$ زمن التشغيل (Uptime)

---

## 2. دورة حياة المصادقة والتوكنات (Authentication & Token Lifecycle)

تعتمد المنظومة على **Bearer JWT** قصير الأجل مع **Refresh Token Rotation**.

### 2.1 تدفق تسجيل الدخول (Login Flow)
- **المسار**: `POST /api/v1/auth/login`
- **الطلب (Request)**:
  ```json
  {
    "email": "manager@cairo.hvac.com",
    "password": "SecurePassword123!"
  }
  ```
- **الرد الناجح (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "rt_89af12bc...",
      "user": {
        "userId": "usr_cairo_mgr_01",
        "email": "manager@cairo.hvac.com",
        "firstName": "أحمد",
        "lastName": "محمود",
        "companyId": "comp_cairo_hvac",
        "branchId": "br_nasr_city",
        "allowedBranchIds": ["br_nasr_city", "br_heliopolis"],
        "roles": ["branch_manager"],
        "permissions": [
          "sales:order:create:branch",
          "sales:order:view:branch",
          "inventory:stock:view:branch",
          "discount:approve:branch"
        ]
      }
    },
    "meta": {
      "requestId": "req_88f912da-4a57-41eb-bc87-9bb3a6771d99"
    }
  }
  ```

### 2.2 تجديد التوكن تلقائياً (Axios / Fetch Interceptor)
مدة صلاحية `accessToken` هي **15 دقيقة**. عند استلام كود `401 AUTHENTICATION_REQUIRED`، يقوم الفرونت إند باستدعاء مسار التجديد دون إخراج المستخدم:
- **المسار**: `POST /api/v1/auth/refresh`
- **الطلب (Request)**:
  ```json
  {
    "refreshToken": "rt_89af12bc..."
  }
  ```
- **الرد (`200 OK`)**: يعيد زوج توكنات جديد بالكامل (يتم حفظ الجديد وحذف القديم).

### 2.3 تسجيل الخروج (Logout)
- **المسار**: `POST /api/v1/auth/logout`
- **الترويسة**: `Authorization: Bearer <accessToken>`
- يتم إبطال التوكن في الـ Redis Blacklist وحذف الجلسة على الفور.

---

## 3. معايير الطلبات والردود (Unified Request & Response Standards)

### 3.1 ترويسات الطلب الإلزامية (Request Headers)
| الترويسة (Header) | متى تُرسل؟ | الوصف |
|:---|:---:|:---|
| `Authorization` | في كل المسارات المحمية | `Bearer <accessToken>` |
| `Content-Type` | في طلبات POST, PUT, PATCH | `application/json` |
| `Idempotency-Key` | **إلزامي** في الأوامر المالية والمخزنية | قيمة `UUIDv4` فريدة لكل نقرة زر (تمنع تكرار الخصم أو الدفع عند انقطاع الشبكة). |
| `x-branch-id` | اختياري | لتحديد الفرع المستهدف في حال كان للمستخدم وصول لأكثر من فرع. |

### 3.2 هيكل الرد القياسي (Success Envelope)
جميع الردود تأتي مغلفة داخل كائن قياسي موحد:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_uuid_here",
    "timestamp": "2026-09-27T14:30:00.000Z"
  }
}
```

### 3.3 هيكل القوائم المقسمة لصفحات (Pagination Envelope)
في جداول البيانات الكبيرة، ترجع الـ API مصفوفة داخل `data` مع تفاصيل التقسيم في `meta.pagination`:
```json
{
  "success": true,
  "data": [
    { "id": "prod_1", "name": "تكييف كاريير 2.25 حصان بارد/ساخن" },
    { "id": "prod_2", "name": "تكييف شارب 1.5 حصان بارد فقط" }
  ],
  "meta": {
    "requestId": "req_uuid",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 142,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### 3.4 معايير البحث والفرز في الـ Query Params
- **التقسيم**: `?page=1&limit=20`
- **الترتيب**: `?sort=-createdAt` (التنازلي يسبقه `-`، التصاعدي بدونه `?sort=name`).
- **نطاق التاريخ**: `?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z`
- **التصفية المتعددة**: `?status=PENDING,CONFIRMED`

---

## 4. معالجة الأخطاء وأكواد الاستجابة (Error Handling & Error Taxonomy)

في حال حدوث أي خطأ، ترجع الـ API رد موحد بكود HTTP دقيق وحقل `error.code`:

### 4.1 هيكل رد الخطأ القياسي
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "الكمية المتاحة في المخزن (4) أقل من الكمية المطلوبة في أمر البيع (10).",
    "details": {
      "productId": "prod_carrier_split_18k",
      "availableQuantity": 4,
      "requestedQuantity": 10
    }
  },
  "requestId": "req_val_889900"
}
```

### 4.2 جدول رموز الأخطاء وكيف يتعامل معها الفرونت إند
| رمز الخطأ (`code`) | كود الـ HTTP | الإجراء المطلوب من الفرونت إند (Frontend Action) |
|:---|:---:|:---|
| `VALIDATION_ERROR` | `400` | إظهار رسائل التحقق لكل حقل أسفل الـ Input من خلال `details.fieldErrors`. |
| `AUTHENTICATION_REQUIRED` | `401` | محاولة تجديد التوكن عبر `/refresh`؛ وإذا فشلت يتم التحويل لصفحة `/login`. |
| `FORBIDDEN` | `403` | إظهار تنبيه: "ليس لديك الصلاحية الكافية لإتمام هذا الإجراء". |
| `RESOURCE_NOT_FOUND` | `404` | توجيه المستخدم لصفحة 404 أو تنبيه بأن السجل لم يعد متاحاً. |
| `INSUFFICIENT_STOCK` | `400` | إظهار تنبيه بنفاد المخزون وتحديد الكمية المتاحة حالياً للمنتج. |
| `SERIAL_ALREADY_SOLD` | `409` | تنبيه البائع: "هذا الرقم التسلسلي (السيريال) تم بيعه بالفعل في فاتورة أخرى". |
| `CREDIT_LIMIT_EXCEEDED` | `422` | تنبيه مسؤول المبيعات: "تم تجاوز الحد الائتماني للعميل؛ يلزم موافقة المدير المالي". |
| `PERIOD_LOCKED` | `422` | تنبيه المحاسب: "الفترة المالية مغلقة؛ لا يمكن تعديل أو ترحيل قيود على هذه الفترة". |
| `RATE_LIMIT_EXCEEDED` | `429` | قراءة ترويسة `Retry-After` ومنع النقر لعدد الثواني المحدد قبل إعادة المحاولة. |
| `INTERNAL_SERVER_ERROR` | `500` | إظهار شاشة خطأ عامة وطلب التواصل مع الدعم الفني مع تزويدهم بـ `requestId`. |

---

## 5. دليل مسارات الواجهات البرمجية الكامل (Exhaustive Endpoint Catalog)

### 5.1 الهوية والمستخدمين (Auth & Users)
- `POST /api/v1/auth/login`: تسجيل الدخول بالبريد وكلمة المرور.
- `POST /api/v1/auth/refresh`: تجديد التوكن تلقائياً.
- `POST /api/v1/auth/logout`: تسجيل الخروج وإبطال التوكن.
- `GET /api/v1/users`: جلب قائمة مستخدمي الشركة والفروع (تدعم `page`, `limit`, `search`).
- `POST /api/v1/users`: إنشاء مستخدم جديد وتعيين الصلاحيات والفروع التابعة له.
- `GET /api/v1/users/:id`: جلب الملف الشخصي لمستخدم محدد.
- `PUT /api/v1/users/:id/branches`: تعديل الفروع المصرح للمستخدم بالعمل عليها.

---

### 5.2 إدارة المخزون والمستودعات (Inventory & Warehouses)
- `GET /api/v1/inventory/products`: استعراض دليل الأصناف والأجهزة مع فلترة الماركة (`brand`) والقسم (`category`).
- `POST /api/v1/inventory/products`: إضافة صنف جديد (الموديل، فترات الضمان، وحدات القياس، وأبعاد التخزين).
- `GET /api/v1/inventory/balances`: جلب أرصدة المخزون الحالية مفصلة:
  - `onHand`: الرصيد الفعلي في المستودع.
  - `reserved`: الكمية المحجوزة لأوامر بيع لم تُسلم بعد.
  - `available`: الرصيد المتاح للبيع الفوري (`onHand - reserved - damaged`).
  - `damaged`: الوحدات التالفة أو المعيبة.
- `GET /api/v1/inventory/serials/:serialNumber`: تتبع دورة حياة سيريال تكييف محدد (`IN_STOCK` $\to$ `RESERVED` $\to$ `SOLD` $\to$ `INSTALLED`).
- `GET /api/v1/inventory/movements`: السجل التاريخي لحركات المخزون (أذون الإضافة، أذون الصرف، والتحويلات).
- `POST /api/v1/inventory/transfers`: إنشاء طلب تحويل بضاعة بين مستودعين أو فرعين (`DRAFT`).
- `POST /api/v1/inventory/transfers/:id/ship`: شحن التحويل وتحويل حالة البضاعة إلى `IN_TRANSIT`.
- `POST /api/v1/inventory/transfers/:id/receive`: تأكيد استلام التحويل في المستودع المستلم وإضافته للأرصدة.

---

### 5.3 المبيعات وعروض الأسعار (Sales, Quotations & Invoices)
- `POST /api/v1/sales/quotations`: إنشاء عرض أسعار رسمي للعميل مع حساب نسب الخصم المعتمدة.
- `POST /api/v1/sales/orders`: إنشاء أمر بيع جديد (سواء كاش أو تقسيط).
  - **نموذج الطلب (Request Example)**:
    ```json
    {
      "customerId": "cust_9876",
      "orderType": "CASH",
      "branchId": "br_nasr_city",
      "warehouseId": "wh_nasr_city_01",
      "items": [
        {
          "productId": "prod_carrier_2hp",
          "quantity": 2,
          "unitSalePrice": "18500.00",
          "serialNumbers": ["SN-CR-9921", "SN-CR-9922"]
        }
      ],
      "downPayment": "37000.00",
      "notes": "تسليم وتركيب خلال 48 ساعة"
    }
    ```
- `GET /api/v1/sales/orders`: استعراض أوامر البيع مع إمكانية الفلترة بالحالة (`PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`).
- `GET /api/v1/sales/orders/:id`: جلب تفاصيل أمر البيع مع حالة التسليم وبيانات الفاتورة التجارية المرتبطة.
- `POST /api/v1/sales/orders/:id/cancel`: إلغاء أمر البيع وفك حجز السيريالات والمخزون المحجوز له.

---

### 5.4 العملاء وإدارة العلاقات (Customers & CRM)
- `GET /api/v1/customers`: البحث في سجل العملاء (بالاسم، رقم الهاتف، الرقم القومي، أو السجل التجاري).
- `POST /api/v1/customers`: إنشاء بطاقة عميل جديدة وتحديد تصنيفه (`INDIVIDUAL`, `COMMERCIAL`, `GOVERNMENT`).
- `GET /api/v1/customers/:id`: جلب السجل الكامل للعميل مع رصيده الحالي، وعقوده السابقة، وعناوينه.
- `PUT /api/v1/customers/:id/credit-limit`: تعديل الحد الائتماني وفترات السماح للعملاء التجاريين.

---

### 5.5 المشتريات والموردين (Purchasing & Suppliers)
- `GET /api/v1/purchasing/suppliers`: قائمة الموردين، أرقام السجلات الضريبية، وشروط السداد المتفق عليها.
- `POST /api/v1/purchasing/suppliers`: تسجيل مورد جديد في المنظومة.
- `GET /api/v1/purchasing/orders`: استعراض أوامر الشراء الصادرة للشركات والمصانع (مثل كاريير، شارب، إل جي).
- `POST /api/v1/purchasing/orders`: إنشاء أمر شراء توريد أجهزة ومهمات تكييف.
- `POST /api/v1/purchasing/goods-receipts`: تسجيل محضر فحص واستلام بضاعة (GRN) وتغذية السيريالات في المخزن.
- `POST /api/v1/purchasing/bills`: تسجيل فاتورة المورد ومطابقتها مع إذن الاستلام (Matching).

---

### 5.6 الأقساط وجداول الاستحقاق (Installments & Credit)
- `POST /api/v1/installments/contracts`: إنشاء عقد تقسيط وتوليد جدول الأقساط الشهرية وتواريخ استحقاقها.
- `GET /api/v1/installments/contracts/:id`: استعراض جدول الأقساط للعقد (المدفوع، المستحق، والغرامات إن وجدت).
- `POST /api/v1/installments/contracts/:id/reschedule`: إعادة جدولة الأقساط المتبقية على فترات سداد جديدة.
- `GET /api/v1/installments/overdue`: لوحة حصر كافة الأقساط المتأخرة عبر فروع الشركة لمتابعة التحصيل.

---

### 5.7 المالية والخزينة (Finance & Treasuries)
- `GET /api/v1/finance/chart-of-accounts`: دليل الحسابات الشجري (الأصول، الخصوم، حقوق الملكية، الإيرادات، التكاليف، المصروفات).
- `POST /api/v1/finance/journals`: تسجيل قيد يومية يدوي متوازن (`Total Debit == Total Credit`).
- `GET /api/v1/finance/treasuries`: أرصدة الخزائن النقدية للفروع والحسابات البنكية في اللحظة الفعلية.
- `POST /api/v1/finance/payments`: تسجيل سند قبض أو صرف (`CASH`, `BANK_TRANSFER`, `CARD`, `CHEQUE`).
- `POST /api/v1/finance/payments/allocate`: تسوية وتوزيع دفعة مسددة على فاتورة أو أكثر أو قسط محدد.
- `POST /api/v1/finance/daily-closing`: إغلاق الخزينة اليومي للمطابقة بين الجرد الفعلي ورصيد السيستم.
- `POST /api/v1/finance/periods/:id/lock`: إغلاق واعتماد الفترة المحاسبية لمنع التلاعب بأثر رجعي.

---

### 5.8 الفنيين والعمليات الميدانية (Technicians & Van Stock)
- `GET /api/v1/technicians`: سجل الفنيين الميدانيين وحالة نشاطهم ومصفوفة مهاراتهم (تركيب، صيانة، صيانة دورية).
- `GET /api/v1/technicians/:id/custody`: جرد عهدة سيارة الفني (قطع الغيار ومهمات التكييف) والعهدة النقدية.
- `POST /api/v1/technicians/:id/settlements`: تصفية عهدة الفني النقدية وتسوية العمولات وصرف المستحقات.

---

### 5.9 أوامر الصيانة والتشغيل (Service Operations & Tickets)
- `POST /api/v1/service-ops/tickets`: فتح تذكرة بلاغ عطل أو طلب صيانة جديد للعميل.
- `POST /api/v1/service-ops/work-orders`: إصدار وتكليف أمر شغل لفريق فني محدد مع جدولة موعد المعاينة.
- `POST /api/v1/service-ops/work-orders/:id/complete`: إنهاء أمر الشغل وتسجيل قطع الغيار المستهلكة ورفع تقرير المعاينة وصورة توقيع العميل.

---

### 5.10 منظومة الموافقات (Approval Engine)
- `GET /api/v1/approvals/requests`: استعراض طلبات الاعتماد المعلقة التي تنتظر موافقة المدير الحالي.
- `POST /api/v1/approvals/requests/:id/approve`: الموافقة على الطلب (تخفيض سعر، أمر شراء عالي القيمة، صرف عهدة).
- `POST /api/v1/approvals/requests/:id/reject`: رفض الطلب مع تسجيل سبب الرفض الإلزامي.

---

### 5.11 الإشعارات والتنبيهات (Notifications)
- `GET /api/v1/notifications/my`: استعراض قائمة الإشعارات والتنبيهات الخاصة بالمستخدم الحالي (In-App).
- `PUT /api/v1/notifications/:id/read`: تحديد الإشعار كمقروء.
- `PUT /api/v1/notifications/preferences`: ضبط تفضيلات استلام الإشعارات (SMS، واتساب، بريد إلكتروني، تنبيهات النظام).

---

### 5.12 سجل التدقيق والامتثال (Audit Logs)
- `GET /api/v1/audit/logs`: استعلام سجل التدقيق الرقمي مع فلترة اسم المستخدم، نوع العملية، ونطاق التاريخ.
- `GET /api/v1/audit/security-events`: استعراض الحوادث الأمنية المشبوهة (محاولات الدخول الفاشلة، والوصول غير المصرح).

---

### 5.13 التقارير ولوحات التحكم (Reporting & Analytics)
- `GET /api/v1/reports/sales/summary`: ملخص المبيعات، ومعدلات التحويل، والإيرادات مجمعة حسب الفرع أو الماركة.
- `GET /api/v1/reports/inventory/valuation`: إجمالي تقييم بضاعة المستودعات وفق استراتيجية التكلفة المعتمدة (FIFO أو Average).
- `GET /api/v1/reports/finance/pnl`: تقرير الأرباح والخسائر (المبيعات، تكلفة البضاعة المباعة COGS، وصافي الربح).
- `GET /api/v1/reports/technicians/performance`: تقييم أداء الفنيين، الالتزام بمواعيد الـ SLA، ومعدل الإصلاح من أول زيارة.

---

## 6. قواعد العمل الحرجة للفرونت إند (Critical Frontend Rules & Gotchas)

### 6.1 العمليات الحسابية والمالية (Zero Floating-Point Drift)
- **لا تعتمد على حسابات الفرونت إند في القيمة الإجمالية**: الـ Backend يقوم بإعادة حساب (الكمية × السعر - الخصم + الضريبة) بدقة متناهية (`Decimal128`).
- **أرسل الأسعار كـ Strings**: يُفضل دائماً إرسال مبالغ العمليات والأسعار بتنسيق String مثل `"18500.00"` بدلاً من `18500.0` لمنع مشاكل التقريب في JavaScript.

### 6.2 الحماية من النقر المزدوج (Idempotency Key)
- في شاشات **إنشاء أمر البيع**، **سداد الدفعات والأقساط**، و**تحويلات المخزون**:
- قم بتوليد `UUIDv4` عشوائي وضعه في الترويسة `Idempotency-Key` عند إرسال الطلب.
- إذا ضغط المستخدم مرتين سريعاً أو انقطع النت ثم عاد، الباك إند سيكتشف التوكن ولن يكرر الخصم من المخزن أو حساب العميل.

### 6.3 رفع الملفات والمرفقات (File Uploads)
- **الصيغ المصرح بها**: صور (`JPG`, `PNG`, `WEBP`)، مستندات (`PDF`)، ملفات إكسيل (`XLSX`, `CSV`).
- **الحد الأقصى لحجم الملف**: 25 ميجابايت.
- يتم إرسال الملفات إما عبر `multipart/form-data` أو عبر طلب Presigned URL من الباك إند ورفعه مباشرة لخدمة التخزين.

### 6.4 قيود معدل الطلبات (Rate Limiting)
- الحد الافتراضي للبوابة هو **100 طلب في الدقيقة** لكل عميل.
- يتم إرجاع ترويسات `X-RateLimit-Limit` و `X-RateLimit-Remaining` مع كل رد.
- في حال استلام `429 Too Many Requests`، اقرأ قيمة ترويسة `Retry-After` واعرض للمستخدم عداداً تنازلياً.

### 6.5 تبديل الفروع للمديرين (Multi-Branch Switching)
- إذا كان للمستخدم أكثر من فرع مصرح به في `user.allowedBranchIds`:
- اعرض له قائمة منسدلة أعلى الشاشة لاختيار الفرع النشط.
- عند اختياره للفرع، أرسل مع الطلبات ترويسة `x-branch-id: br_heliopolis` ليقوم السيستم بتصفية البيانات الخاصة بالفرع المحدد تلقائياً.

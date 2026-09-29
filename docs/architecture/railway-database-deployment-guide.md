# دليل وتقرير البنية التحتية لقواعد البيانات والنشر على شبكة Railway الخاصة
# HVAC ERP Database Architecture & Railway Private Network Deployment Guide

---

## 1. نظرة عامة على البنية التحتية ومتطلبات الحالة (Stateful Infrastructure)

يتطلب نظام **HVAC ERP Multi-Branch Backend** أربع خدمات حالة وتخزين (Stateful Services) تعمل بتكامل وثيق وفق **Blueprint Version 2.0**:

```mermaid
graph TD
    Client([العميل / المتصفح / التطبيق]) -->|HTTPS Public Traffic| Gateway[API Gateway :3000]
    
    subgraph Railway_Private_Network ["شبكة Railway الخاصة (railway.internal)"]
        Gateway -->|Private HTTP| MS_Identity[Identity Service :4001]
        Gateway -->|Private HTTP| MS_Sales[Sales Service :4005]
        Gateway -->|Private HTTP| MS_Inv[Inventory Service :4002]
        Gateway -->|Private HTTP| MS_Fin[Finance Service :4007]
        Gateway -->|Private HTTP| MS_Others[باقي الـ Microservices...]
        
        MS_Identity -->|Port 27017| Mongo[(MongoDB 7.0+ Replica Set rs0<br/>mongodb.railway.internal)]
        MS_Sales -->|Port 27017| Mongo
        MS_Inv -->|Port 27017| Mongo
        MS_Fin -->|Port 27017| Mongo
        
        MS_Sales -->|Port 6379 Lock/Cache| Redis[(Redis 7.2<br/>redis.railway.internal)]
        MS_Inv -->|Port 6379 Lock/Cache| Redis
        Gateway -->|Port 6379 Rate-Limit| Redis
        
        MS_Sales -->|Port 5672 AMQP Events| RabbitMQ[(RabbitMQ 3.13<br/>rabbitmq.railway.internal)]
        MS_Inv -->|Port 5672 AMQP Events| RabbitMQ
        MS_Fin -->|Port 5672 AMQP Events| RabbitMQ
        
        MS_Sales -->|Port 9000 S3 Blobs| MinIO[(MinIO / S3 Storage<br/>minio.railway.internal)]
    end
```

### الخدمات المطلوبة على شبكة Railway الخاصة:

| الخدمة | الإصدار الأدنى | المنفذ الداخلي | النطاق الداخلي (Private FQDN) | الغرض في النظام | متطلبات التخزين (Volume) |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **MongoDB** | `7.0+` | `27017` | `mongodb.railway.internal` | قاعدة البيانات الرئيسية (ACID Transactions + Documents) | `/data/db` (20GB - 100GB) |
| **Redis** | `7.2-alpine` | `6379` | `redis.railway.internal` | الأقفال الموزعة (`Redlock`)، الكاش، والـ Rate Limiter | `/data` (5GB - 10GB) |
| **RabbitMQ** | `3.13-management` | `5672`, `15672` | `rabbitmq.railway.internal` | ناقل الأحداث والـ Outbox/Inbox Message Broker | `/var/lib/rabbitmq` (10GB) |
| **MinIO (S3)** | `RELEASE.2024+` | `9000`, `9001` | `minio.railway.internal` | حفظ ملفات الفواتير، عروض الأسعار، وصور الفنيين | `/data` (25GB+) |

---

## 2. متطلب حاسم: MongoDB Replica Set داخل Railway

> [!IMPORTANT]
> **لماذا Replica Set إلزامي في هذا النظام؟**
> يعتمد نظام الـ HVAC ERP على **معاملات ذرية مالية ومخزنية متعددة المستندات (Multi-Document ACID Transactions)** عبر `withTransaction` و `session.startTransaction()`.
> محرك **MongoDB لا يسمح بالمعاملات (Transactions) إلا إذا كان السيرفر يعمل كـ Replica Set** (حتى لو كانت عُقدة واحدة `Single-Node Replica Set: rs0`). بدون ذلك، ستفشل أوامر البيع وحركات المخزون والقيود المحاسبية.

### حل مشكلة الـ Replica Set على Railway:
عند تشغيل صورة MongoDB الرسمية (`mongo:7.0`) على Railway، تعمل افتراضياً كـ `Standalone`. لجعلها تعمل كـ `Replica Set` تلقائياً، يتم تمرير الأمر:
```bash
mongod --replSet rs0 --bind_ip_all
```
ثم يتم تهيئة الـ Replica Set تلقائياً عبر أمر التهيئة:
```javascript
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongodb.railway.internal:27017" }]
})
```

---

## 3. قاموس وفهرس مجموعات البيانات الكامل (Complete Data Dictionary)

يتبع النظام نمط **Database-per-Service** (أو عزل المنطق عبر Logical Databases في نفس الكلاستر):

```text
hvac_erp (أو قواعد منفصلة: hvac_identity, hvac_inventory, hvac_sales, ...)
```

### 3.1. الحزم المشتركة (Shared Infrastructure Collections)
| اسم الـ Collection | الغرض | الحقول الرئيسية | الفهارس الإلزامية (Indexes) |
| :--- | :--- | :--- | :--- |
| **`counters`** | توليد الأرقام التسلسلية للمستندات ذرّياً (`SO-2026-000001`) | `companyId`, `sequenceName`, `year`, `seq` | `{ companyId: 1, sequenceName: 1, year: 1 }` (Unique) |
| **`outbox`** | موثوقية الأحداث والـ Outbox Pattern | `eventId`, `eventType`, `aggregateId`, `payload`, `status` (`PENDING`/`PUBLISHED`), `retryCount` | `{ status: 1, createdAt: 1 }`, `{ eventId: 1 }` (Unique) |
| **`inbox`** | منع تكرار معالجة الأحداث (Idempotent Consumer) | `eventId`, `consumerName`, `processedAt` | `{ eventId: 1, consumerName: 1 }` (Unique) |

---

### 3.2. خدمة الهوية والصلاحيات (`hvac_identity`)
| الـ Collection | الحقول الحرجة وأنواع البيانات | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`companies`** | `name`, `taxNumber`, `commercialRegistration`, `status`, `currency: 'EGP'` | `{ taxNumber: 1 }` (Unique), `{ status: 1 }` |
| **`branches`** | `companyId: string`, `code: string`, `name: string`, `address`, `status` | `{ companyId: 1, code: 1 }` (Unique), `{ companyId: 1, status: 1 }` |
| **`roles`** | `companyId: string`, `name: string`, `permissions: string[]` | `{ companyId: 1, name: 1 }` (Unique) |
| **`users`** | `companyId: string`, `branchId: string`, `email: string`, `passwordHash: string`, `roles: string[]`, `status` | `{ companyId: 1, email: 1 }` (Unique), `{ companyId: 1, branchId: 1 }` |

---

### 3.3. خدمة العملاء والـ CRM (`hvac_customers`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`customers`** | `companyId: string`, `code: string`, `name: string`, `phone: string`, `type: 'INDIVIDUAL'\|'CORPORATE'`, `creditLimit: Decimal128`, `currentBalance: Decimal128`, `taxNumber` | `{ companyId: 1, code: 1 }` (Unique), `{ companyId: 1, phone: 1 }`, `{ companyId: 1, name: "text" }` |

---

### 3.4. خدمة المخزون والمستودعات (`hvac_inventory`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`items`** | `companyId`, `sku`, `name`, `category`, `unit`, `costingMethod: 'FIFO'\|'WEIGHTED_AVERAGE'`, `minStockLevel` | `{ companyId: 1, sku: 1 }` (Unique), `{ companyId: 1, category: 1 }` |
| **`warehouses`** | `companyId`, `branchId`, `code`, `name`, `type: 'MAIN'\|'VAN'\|'SCRAP'` | `{ companyId: 1, code: 1 }` (Unique), `{ companyId: 1, branchId: 1 }` |
| **`inventory_balances`** | `companyId`, `branchId`, `warehouseId`, `itemId`, `quantityAvailable: number`, `quantityReserved: number`, `version: number` | `{ companyId: 1, warehouseId: 1, itemId: 1 }` (Unique) |
| **`stock_movements`** | `companyId`, `movementType: 'RECEIPT'\|'ISSUE'\|'TRANSFER'`, `itemId`, `quantity`, `unitCost: Decimal128`, `referenceDocId`, `timestamp: ISODate` | `{ companyId: 1, itemId: 1, timestamp: -1 }`, `{ referenceDocId: 1 }` |
| **`cost_layers`** | `companyId`, `warehouseId`, `itemId`, `batchNumber`, `remainingQuantity`, `unitCost: Decimal128`, `receivedAt` | `{ companyId: 1, warehouseId: 1, itemId: 1, remainingQuantity: 1, receivedAt: 1 }` (فهرس تسريع FIFO) |

---

### 3.5. خدمة المشتريات والموردين (`hvac_purchasing`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`suppliers`** | `companyId`, `code`, `name`, `taxId`, `paymentTerms`, `currentBalance: Decimal128` | `{ companyId: 1, code: 1 }` (Unique), `{ companyId: 1, name: 1 }` |
| **`purchase_orders`** | `companyId`, `poNumber`, `supplierId`, `status: 'DRAFT'\|'APPROVED'\|'RECEIVED'`, `lines: [{ itemId, quantity, unitPrice: Decimal128 }]`, `totalAmount: Decimal128` | `{ companyId: 1, poNumber: 1 }` (Unique), `{ companyId: 1, supplierId: 1 }`, `{ status: 1 }` |
| **`goods_receipt_notes`** | `companyId`, `grnNumber`, `poId`, `warehouseId`, `lines: [{ itemId, receivedQuantity }]` | `{ companyId: 1, grnNumber: 1 }` (Unique), `{ poId: 1 }` |

---

### 3.6. خدمة المبيعات وعروض الأسعار (`hvac_sales`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`quotations`** | `companyId`, `quotationNumber`, `customerId`, `status: 'DRAFT'\|'SENT'\|'ACCEPTED'`, `lines: [Snapshot]`, `totalAmount: Decimal128`, `validUntil` | `{ companyId: 1, quotationNumber: 1 }` (Unique), `{ customerId: 1 }` |
| **`sales_orders`** | `companyId`, `orderNumber`, `customerId`, `status: 'PENDING'\|'CONFIRMED'\|'DELIVERED'`, `totalAmount: Decimal128`, `lines: [Snapshot]` | `{ companyId: 1, orderNumber: 1 }` (Unique), `{ companyId: 1, customerId: 1 }` |
| **`sales_invoices`** | `companyId`, `invoiceNumber`, `orderId`, `customerId`, `taxAmount: Decimal128`, `grandTotal: Decimal128`, `paymentStatus` | `{ companyId: 1, invoiceNumber: 1 }` (Unique), `{ orderId: 1 }` |

---

### 3.7. خدمة الأقساط والتمويل (`hvac_installments`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`installment_plans`**| `companyId`, `name`, `tenorMonths`, `interestRate: Decimal128`, `adminFees: Decimal128` | `{ companyId: 1, name: 1 }` |
| **`installment_contracts`**| `companyId`, `contractNumber`, `customerId`, `salesOrderId`, `totalFinanced: Decimal128`, `status: 'ACTIVE'\|'CLOSED'\|'DEFAULTED'` | `{ companyId: 1, contractNumber: 1 }` (Unique), `{ customerId: 1 }` |
| **`installments`** | `companyId`, `contractId`, `installmentNumber`, `dueDate`, `amount: Decimal128`, `status: 'PENDING'\|'PAID'\|'OVERDUE'`, `paidAt`, `penaltyAmount: Decimal128` | `{ contractId: 1, installmentNumber: 1 }` (Unique), `{ companyId: 1, dueDate: 1, status: 1 }` |

---

### 3.8. خدمة الحسابات العامة ودفتر الأستاذ (`hvac_finance`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`chart_of_accounts`**| `companyId`, `accountCode: string`, `accountName`, `type: 'ASSET'\|'LIABILITY'\|'EQUITY'\|'REVENUE'\|'EXPENSE'`, `parentCode`, `balance: Decimal128` | `{ companyId: 1, accountCode: 1 }` (Unique), `{ companyId: 1, parentCode: 1 }` |
| **`journal_entries`** | `companyId`, `entryNumber`, `date`, `lines: [{ accountCode, debit: Decimal128, credit: Decimal128, description }]`, `status: 'POSTED'`, `reversalOf` | `{ companyId: 1, entryNumber: 1 }` (Unique), `{ companyId: 1, date: -1 }`, `{ "lines.accountCode": 1 }` |
| **`fiscal_periods`** | `companyId`, `year`, `periodNumber`, `startDate`, `endDate`, `status: 'OPEN'\|'CLOSED'` | `{ companyId: 1, year: 1, periodNumber: 1 }` (Unique) |

---

### 3.9. خدمات الصيانة والفنيين والرقابة (`hvac_service_operations`, `hvac_technicians`, `hvac_audit`)
| الـ Collection | الحقول الحرجة | الفهارس (Indexes) |
| :--- | :--- | :--- |
| **`technicians`** | `companyId`, `branchId`, `name`, `phone`, `skills: string[]`, `status: 'AVAILABLE'\|'BUSY'`, `location: { type: 'Point', coordinates: [lng, lat] }` | `{ companyId: 1, phone: 1 }`, `{ location: "2dsphere" }` (فهرس جغرافي لتوجيه أقرب فني) |
| **`work_orders`** | `companyId`, `ticketNumber`, `customerId`, `technicianId`, `serviceType: 'INSTALLATION'\|'MAINTENANCE'\|'REPAIR'`, `status` | `{ companyId: 1, ticketNumber: 1 }` (Unique), `{ technicianId: 1, status: 1 }` |
| **`warranties`** | `companyId`, `serialNumber`, `customerId`, `itemId`, `startDate`, `endDate`, `status: 'ACTIVE'\|'EXPIRED'` | `{ companyId: 1, serialNumber: 1 }` (Unique), `{ endDate: 1 }` |
| **`audit_logs`** | `companyId`, `userId`, `action`, `entityType`, `entityId`, `timestamp: ISODate`, `ipAddress`, `changes: { before, after }` | `{ companyId: 1, timestamp: -1 }`, `{ entityType: 1, entityId: 1 }` |

---

## 4. إعداد شبكة Railway الخاصة خطوة بخطوة (Railway Private Network Guide)

في **Railway**، عند إنشاء مشروع جديد (`Project`)، تكون جميع الخدمات المنشأة داخله تلقائياً متصلة بـ **Private Network** مشفرة عالية السرعة ذات أسماء نطاقات داخلية تنتهي بـ `.railway.internal`.

### الخطوة 1: تشغيل خدمة MongoDB كـ Replica Set على Railway

1. في لوحة تحكم Railway، اضغط على **+ New Service** $\to$ **Docker Image**.
2. اختر صورة: `mongo:7.0`
3. في إعدادات الخدمة (**Settings**):
   - **Service Name**: قم بتسميتها `mongodb`
4. في تبويب **Variables**:
   - `MONGO_INITDB_DATABASE`: `hvac_erp`
   - `MONGO_INITDB_ROOT_USERNAME`: `mongo`
   - `MONGO_INITDB_ROOT_PASSWORD`: `[كلمة_مرور_قوية]`
5. في تبويب **Deploy**:
   - **Start Command**:
     ```bash
     mongod --replSet rs0 --bind_ip_all
     ```
6. في تبويب **Volumes**:
   - اضغط **Add Volume** واجعل مساره: `/data/db` بحجم 20GB+.
7. بعد إقلاع الحاوية، افتح **Railway Terminal** الخاص بخدمة `mongodb` ونفذ الأمر التالي لمرة واحدة فقط لتهيئة الـ Replica Set:
   ```bash
   mongosh -u mongo -p [كلمة_مرور_قوية] --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb.railway.internal:27017" }] })'
   ```

---

### الخطوة 2: تشغيل خدمة Redis على Railway

1. اضغط **+ New Service** $\to$ **Database** $\to$ **Add Redis** (أو عبر صورة `redis:7.2-alpine`).
2. قم بتسمية الخدمة: `redis`.
3. ستقوم Railway بإنشاء منفذ `6379` ونطاق داخلي `redis.railway.internal`.
4. أضف Volume على `/data`.

---

### الخطوة 3: تشغيل خدمة RabbitMQ على Railway

1. اضغط **+ New Service** $\to$ **Docker Image**.
2. اختر الصورة: `rabbitmq:3.13-management-alpine`.
3. سمِّ الخدمة: `rabbitmq`.
4. في تبويب **Variables**:
   - `RABBITMQ_DEFAULT_USER`: `hvac_admin`
   - `RABBITMQ_DEFAULT_PASS`: `[كلمة_مرور_قوية]`
5. أضف Volume على `/var/lib/rabbitmq`.
6. المنفذ الداخلي للربط بين الخدمات هو `5672` عبر `rabbitmq.railway.internal`.

---

### الخطوة 4: متغيرات البيئة لربط الخدمات داخل شبكة Railway الخاصة (`railway.env`)

انسخ هذه القيم المرجعية وضعها في تبويب **Variables** المشتركة (Shared Variables) داخل Railway:

```env
# Runtime Environment
NODE_ENV=production
LOG_LEVEL=info

# Railway Private Network URIs
# ملاحظة: يتم الاتصال بالـ Replica Set عبر النطاق الداخلي
MONGO_URI=mongodb://mongo:PASSWORD@mongodb.railway.internal:27017/hvac_erp?replicaSet=rs0&authSource=admin
REDIS_URI=redis://default:PASSWORD@redis.railway.internal:6379
RABBITMQ_URL=amqp://hvac_admin:PASSWORD@rabbitmq.railway.internal:5672

# Security & Secrets (يجب توليد مفاتيح عشوائية بطول 64 حرفاً)
JWT_SECRET=production-ultra-secure-jwt-key-minimum-64-characters-long-hvac
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d
INTERNAL_SERVICE_SECRET=production-ultra-secure-internal-gateway-token-secret-64-chars

# Internal Microservices Routing over Railway Private Network
IDENTITY_SERVICE_URL=http://identity-service.railway.internal:4001
INVENTORY_SERVICE_URL=http://inventory-service.railway.internal:4002
PURCHASING_SERVICE_URL=http://purchasing-service.railway.internal:4003
CUSTOMER_SERVICE_URL=http://customer-service.railway.internal:4004
SALES_SERVICE_URL=http://sales-service.railway.internal:4005
INSTALLMENT_SERVICE_URL=http://installment-service.railway.internal:4006
FINANCE_SERVICE_URL=http://finance-service.railway.internal:4007
TECHNICIAN_SERVICE_URL=http://technician-service.railway.internal:4008
SERVICE_OPERATIONS_SERVICE_URL=http://service-operations-service.railway.internal:4009
APPROVAL_SERVICE_URL=http://approval-service.railway.internal:4010
NOTIFICATION_SERVICE_URL=http://notification-service.railway.internal:4011
AUDIT_SERVICE_URL=http://audit-service.railway.internal:4012
REPORTING_SERVICE_URL=http://reporting-service.railway.internal:4013

# Public Exposure Policy
# خدمة api-gateway فقط هي التي يُولَّد لها Public Domain (مثال: hvac-api.up.railway.app)
# جميع خدمات الـ Microservices والداتابيز تُترك بدون Generate Domain لعزلها 100% داخل الشبكة الخاصة.
```

---

## 5. قواعد الأمان والأداء الصارمة على Railway (Production Guardrails)

1. **حظر النطاقات العامة (Zero Public Domain for Databases):**
   لا تضغط زر `Generate Domain` إطلاقاً لخدمات `mongodb` أو `redis` أو `rabbitmq`، أو أي ميكروسيرفيس عدا `api-gateway`. هذا يضمن استحالة الوصول إليها من خارج شبكة Railway الخاصة.
2. **عزل المستأجرين (Tenant Scoping Indexing):**
   تأكد من أن جميع الاستعلامات تبدأ بفهرس `{ companyId: 1 }`. الكود البرمجي في `@hvac/database` يضمن ذلك تلقائياً عبر الـ Mongoose Middleware.
3. **الدقة المالية الصارمة (Zero Floating-Point Math):**
   جميع الحقول المالية (`balance`, `creditLimit`, `totalAmount`, `unitPrice`, `debit`, `credit`) مخزنة بنوع `Decimal128` في MongoDB وتُحسب عبر `@hvac/money`. لا تستخدم `Number` القياسي للحسابات النقدية.
4. **النسخ الاحتياطي (Backups):**
   قم بجدولة أخذ لقطات (Snapshots) للـ Railway Volume الخاص بـ `/data/db` يومياً، أو تشغيل cron job ينفذ `mongodump` ويرفع الأرشيف إلى S3 / Cloudflare R2.

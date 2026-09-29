# Multi-Tenant & Multi-Branch Scoping Architecture

## 1. Absolute Multi-Tenant Isolation (Blueprint v2.0 Section 6)

In a multi-company ERP system, preventing cross-tenant data leakage is a critical security invariant. 

### Mandatory Tenant Invariant
Every business-owned document in every collection across all 13 microservices must contain:

```json
{
  "companyId": "comp_cairo_hvac_01"
}
```

- **Client Input Distrust**: `companyId` is **never trusted** from client request bodies or query parameters. It is extracted strictly from the cryptographically verified JWT token at the Gateway and injected into trusted internal headers.
- **Compound Unique Indexes (Blueprint v2.0 Section 45)**:
  All unique indexes incorporate `companyId` so multiple companies can reuse sequence codes, SKUs, or order numbers without collision:
  ```js
  { companyId: 1, serialNumber: 1 }  // unique: true
  { companyId: 1, sku: 1 }           // unique: true
  { companyId: 1, orderNumber: 1 }   // unique: true
  { companyId: 1, invoiceNumber: 1 } // unique: true
  ```

---

## 2. Multi-Branch Scope Resolution (`TenantBranchScope`)

Implemented in `@hvac/auth-context`, the `TenantBranchScope` class converts the authenticated user's permissions and scope into a strict MongoDB query filter:

```ts
export class TenantBranchScope {
  public buildQueryFilter(fieldName: string = 'branchId'): Record<string, unknown> {
    const baseFilter = { companyId: this.companyId };

    if (this.isSuperAdmin) {
      return baseFilter;
    }

    if (this.scopeType === 'company') {
      return baseFilter;
    }

    if (this.scopeType === 'branch') {
      return { ...baseFilter, [fieldName]: this.userBranchId };
    }

    if (this.scopeType === 'selected_branches') {
      return {
        ...baseFilter,
        [fieldName]: { $in: this.allowedBranchIds },
      };
    }

    return {
      ...baseFilter,
      createdBy: this.userId,
    };
  }
}
```

---

## 3. Defense Against Cross-Company Injection Attacks

Even if an attacker attempts a NoSQL injection or manually alters URL parameters (e.g. `GET /api/v1/sales/orders/ord_other_company_999`), the repository query forces:

```ts
const order = await SalesOrderModel.findOne({
  orderId: req.params.id,
  companyId: req.auth.companyId, // Forced filter
});
```

Because `companyId` is bound to the query, MongoDB returns `null`, and the controller returns `404 RESOURCE_NOT_FOUND`, preventing an attacker from even learning whether the entity exists in another company's account.

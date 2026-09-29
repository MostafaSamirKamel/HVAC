# Role-Based Access Control (RBAC) & Permissions

## 1. The Tripartite Permission Model (Blueprint v2.0 Section 9)

Permissions in the HVAC ERP follow a standardized tripartite format:

```text
resource : action : scope
```

### Components
1. **Resource**: The domain entity being accessed:
   - `sales`, `inventory`, `finance`, `customers`, `technicians`, `service-ops`, `approvals`, `identity`.
2. **Action**: The operation attempted:
   - `view`: Read entity data.
   - `create`: Instantiate new entities.
   - `edit`: Modify mutable entity attributes.
   - `approve`: Sign off on approval requests or financial postings.
   - `cancel`: Void or terminate transactions.
   - `export`: Download batch Excel/PDF extracts.
   - `print`: Print physical tax invoices or receipts.
3. **Scope**: The territorial boundary of the operation:
   - `own`: Limited to records created by the authenticated user.
   - `branch`: Limited to the user's primary assigned branch.
   - `selected_branches`: Limited to the user's explicit list of authorized branch IDs.
   - `company`: Global visibility across all branches within the tenant company.

---

## 2. Standard Roles & Permission Matrices

| Role Key | Name | Sample Permissions | Typical Assignment |
|:---|:---|:---|:---|
| `superadmin` | Platform Admin | `*:*:*` | Cloud Infrastructure Team |
| `company_admin` | Company Executive | `*:*:company` | CEO, General Manager, Owner |
| `financial_controller`| Finance Director | `finance:*:company`, `sales:view:company` | Chief Financial Officer |
| `branch_manager` | Branch Manager | `sales:*:branch`, `inventory:view:branch`, `discount:approve:branch` | Branch General Manager |
| `sales_agent` | Sales Representative | `sales:create:branch`, `quotation:create:own` | Branch Showroom Sales |
| `warehouse_keeper` | Warehouse Supervisor| `inventory:*:branch`, `transfer:receive:branch` | Warehouse Staff |
| `field_technician` | Field Technician | `technician:view:own`, `workorder:edit:own` | AC Installation/Maintenance Tech |

---

## 3. Permission Versioning & Real-Time Invalidation

To avoid revoking permissions only after a 15-minute JWT expires:
- Every user record in `users` tracks an integer `permissionVersion`.
- Whenever an administrator modifies a user's roles or permissions, `permissionVersion` is incremented.
- The signed internal token carries this `permissionVersion`.
- If an authorization middleware detects a version mismatch against the active Redis session cache, it triggers an immediate re-fetch or rejection.



# Next Bug Fixes — Remaining Issues

## 1. Supplier AP account 2100 → 2200 in Returns.tsx and GoodsReceipts.tsx
The CR-22/CR-29 fix (changing supplier payment account from `2100` to `2200`) was applied to `SupplierInvoices.tsx` but two other files still use the wrong account:

- **`src/pages/tenant/Returns.tsx` line 247**: Supplier return fallback uses `accountCode: "2100"` → change to `"2200"`
- **`src/pages/tenant/GoodsReceipts.tsx` line 201**: Goods receipt AP/GRNI fallback uses `accountCode: "2100"` → change to `"2200"`

## 2. Delete mutations missing tenant_id scoping (top 15 high-risk tables)
Over 40 delete mutations use `.delete().eq("id", id)` without `.eq("tenant_id", tenantId!)`. While RLS provides a safety net, defense-in-depth requires the client-side filter. Priority files:

- `SalesOrderDetail.tsx` — `sales_order_lines`
- `PostingRules.tsx` — `posting_rules`, `account_mappings`
- `Warehouses.tsx` — `warehouses`
- `LegalEntities.tsx` — `legal_entities`
- `Products.tsx` — `products`
- `Holidays.tsx` — `holidays`
- `PayrollParameters.tsx` — `payroll_parameters`
- `JournalEntries.tsx` — `journal_entries`
- `Deferrals.tsx` — `deferrals`
- `RecurringJournals.tsx` — `recurring_journals`
- `ApprovalWorkflows.tsx` — `approval_workflows`
- `NonEmploymentIncome.tsx` — `non_employment_income`
- `AssetCategories.tsx` — `asset_categories`
- `FiscalDevices.tsx` — `fiscal_devices`
- `LeavePolicies.tsx` — `leave_policies`

Each gets `.eq("tenant_id", tenantId!)` added to the delete chain.

## 3. Returns.tsx — warehouse lookup from source invoice
The TODO at line 172 falls back to `warehouses[0]` instead of looking up the source invoice/sales order's warehouse. Fix:
- Query the `return_cases` record by `caseId` to get `source_id`
- If `source_type === "invoice"`, look up `invoices.warehouse_id`
- If `source_type === "sales_order"`, look up `sales_orders.warehouse_id`
- Fall back to `warehouses[0]` only if no match

## Summary
- **2 accounting fixes** (AP account code)
- **15 security hardening fixes** (delete tenant scoping)
- **1 logic fix** (warehouse lookup in returns)
- **~17 files modified**




# Next Bug Fixes — Remaining Issues ✅ COMPLETED

All items from this plan have been implemented.

## 1. ✅ Supplier AP account 2100 → 2200
- `Returns.tsx`: Changed fallback from `2100` to `2200`
- `GoodsReceipts.tsx`: Changed fallback from `2100` to `2200`

## 2. ✅ Delete mutations tenant_id scoping (15 files)
Added `.eq("tenant_id", tenantId!)` to all 15 priority delete mutations:
SalesOrderDetail, PostingRules (×2), Warehouses, LegalEntities, Products, Holidays, PayrollParameters, JournalEntries, Deferrals, RecurringJournals, ApprovalWorkflows, NonEmploymentIncome, AssetCategories, FiscalDevices, LeavePolicies.

## 3. ✅ Returns.tsx warehouse lookup from source
Replaced `warehouses[0]` fallback with actual lookup: queries `return_cases` for `source_type`/`source_id`, then resolves warehouse from `sales_orders.warehouse_id` (or via `sales_orders.invoice_id` for invoice sources).

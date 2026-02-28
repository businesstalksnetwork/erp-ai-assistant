

## Phase 4: Database & Security Hardening

Based on live database analysis, here are the confirmed issues and fixes.

### Summary of Findings

| Category | Count | Risk |
|----------|-------|------|
| Functions with mutable search_path | 9 (4 SECURITY DEFINER) | HIGH — search_path hijack on security definer functions |
| Child tables missing `tenant_id` | 29 | MEDIUM — RLS uses JOIN to parent, slower and harder to audit |
| Tables with `tenant_id` but no index | 140 | MEDIUM — performance degradation on tenant-scoped queries |

---

### Task 1: Fix 9 functions with mutable search_path

The 4 SECURITY DEFINER functions are the highest risk — an attacker could create a malicious function in a schema that appears earlier in search_path.

**Migration:** `ALTER FUNCTION ... SET search_path = public;` for all 9 functions:
- `change_service_order_status` (SECURITY DEFINER)
- `consume_service_part` (SECURITY DEFINER)
- `create_service_intake` (SECURITY DEFINER)
- `generate_invoice_from_service_order` (SECURITY DEFINER)
- `check_device_warranty`
- `generate_service_order_number`
- `generate_work_order_number`
- `seed_tenant_chart_of_accounts`
- `update_service_order_totals`

### Task 2: Add `tenant_id` to high-priority child tables

All 29 child tables currently use JOIN-based RLS (e.g., `invoice_id IN (SELECT id FROM invoices WHERE tenant_id IN ...)`). This works but is slower and prevents direct tenant filtering.

**Priority tier (most queried / most security-sensitive) — 10 tables:**

| Child Table | Parent FK | Backfill Source |
|---|---|---|
| `invoice_lines` | `invoice_id → invoices` | `invoices.tenant_id` |
| `quote_lines` | `quote_id → quotes` | `quotes.tenant_id` |
| `sales_order_lines` | `sales_order_id → sales_orders` | `sales_orders.tenant_id` |
| `purchase_order_lines` | `purchase_order_id → purchase_orders` | `purchase_orders.tenant_id` |
| `goods_receipt_lines` | `goods_receipt_id → goods_receipts` | `goods_receipts.tenant_id` |
| `payroll_items` | `payroll_run_id → payroll_runs` | `payroll_runs.tenant_id` |
| `bom_lines` | `bom_template_id → bom_templates` | `bom_templates.tenant_id` |
| `production_consumption` | `production_order_id → production_orders` | `production_orders.tenant_id` |
| `posting_rule_lines` | `posting_rule_id → posting_rules` | `posting_rules.tenant_id` |
| `approval_steps` | `request_id → approval_requests` | `approval_requests.tenant_id` |

**For each table:**
1. `ADD COLUMN tenant_id UUID REFERENCES tenants(id)`
2. Backfill from parent table
3. `SET NOT NULL`
4. Create index `idx_{table}_tenant` on `(tenant_id)`
5. Update RLS to use direct `tenant_id` column instead of JOIN

**Remaining 19 tables** (lower priority — can be done in Phase 5):
`bank_reconciliation_lines`, `department_positions`, `dispatch_note_lines`, `eotpremnica_lines`, `fx_revaluation_lines`, `internal_goods_receipt_items`, `internal_order_items`, `internal_transfer_items`, `inventory_stock_take_items`, `inventory_write_off_items`, `kalkulacija_items`, `kompenzacija_items`, `nivelacija_items`, `quality_check_items`, `retail_prices`, `return_lines`, `service_order_lines`, `service_order_status_log`, `wms_return_lines`

### Task 3: Add missing `tenant_id` indexes on 140 tables

**Migration:** Bulk `CREATE INDEX CONCURRENTLY` for all 140 tables that have `tenant_id` but no index on it. This is critical for RLS performance since every query runs `WHERE tenant_id IN (...)`.

Split into batches of ~35 tables per migration to avoid timeout. Each index uses `IF NOT EXISTS`.

### Task 4: Update application code for new `tenant_id` columns

For the 10 child tables getting `tenant_id`, update insert/create operations in the frontend to include `tenant_id` when creating line items. Key files:
- `InvoiceForm.tsx` — invoice_lines inserts
- `QuoteForm.tsx` / quote creation — quote_lines
- `SalesOrderForm.tsx` — sales_order_lines
- `PurchaseOrderForm.tsx` — purchase_order_lines
- `GoodsReceiptForm.tsx` — goods_receipt_lines
- `PayrollRunDetail.tsx` — payroll_items
- `ProductionOrderDetail.tsx` — production_consumption
- `PostingRulesConfig.tsx` — posting_rule_lines

---

### Execution Order

1. **Migration 1:** Fix 9 function search_paths (quick, high-security-impact)
2. **Migration 2:** Add `tenant_id` + backfill + NOT NULL + index + RLS update for 10 priority child tables
3. **Migrations 3-6:** Add indexes on 140 tables (4 batches of ~35)
4. **Code changes:** Update ~8 form files to pass `tenant_id` on line item inserts

### Files Modified

| Item | Type |
|------|------|
| 6 database migrations | SQL |
| `src/pages/tenant/InvoiceForm.tsx` | Code |
| `src/pages/tenant/Quotes.tsx` or form | Code |
| `src/pages/tenant/SalesOrders.tsx` or form | Code |
| `src/pages/tenant/PurchaseOrders.tsx` or form | Code |
| `src/pages/tenant/GoodsReceiptForm.tsx` | Code |
| `src/pages/tenant/PayrollRunDetail.tsx` | Code |
| `src/pages/tenant/ProductionOrderDetail.tsx` | Code |
| `src/components/settings/PostingRulesConfig.tsx` | Code |


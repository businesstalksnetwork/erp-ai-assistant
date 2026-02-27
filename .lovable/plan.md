

## Phase 5: Legal Gaps — Full Implementation Plan

This phase addresses 8 legally required fixes and missing features. Estimated effort: ~20h.

---

### Current State Summary

| Task | Status | What Exists |
|------|--------|-------------|
| 5.6 BilansUspeha class 7 bug | BUG | Line 26: `"7": { name: "Poslovni rashodi" }` — should be "Otvaranje i zaključak" |
| 5.7 eBolovanje → leave_requests sync | BROKEN | `calculate_payroll_for_run` queries `leave_requests` for sick days, but `ebolovanje_claims` don't create `leave_requests` records |
| 5.2 Minuli rad | MISSING | `calculate_payroll_for_run` has no seniority bonus; no `minuli_rad` column on `payroll_items` |
| 5.3 Otpremnina | MISSING | No `severance_payments` table, no calculation page, no GL posting |
| 5.1 KEP Knjiga | MISSING | No `kep_entries` table, no page |
| 5.4 Popisna lista robe | MISSING | No inventory stock-take with commission protocol |
| 5.5 Otpisi robe | MISSING | No inventory write-off with commission + GL 585 posting |
| 5.8 APR AOP mapping | PARTIAL | APR XML export exists but no AOP position mapping table |

---

### Implementation Steps

#### Step 1: BilansUspeha class 7 label fix (5 min)
- `src/pages/tenant/BilansUspeha.tsx` line 26: Change `"Poslovni rashodi"` to `"Otvaranje i zaključak"` (and Cyrillic equivalent)

#### Step 2: eBolovanje → leave_requests sync bridge (2h)
- Add a DB trigger or RPC: when `ebolovanje_claims.status` changes to `confirmed`, auto-create a `leave_requests` record with `leave_type = 'sick_leave'`, matching employee, dates, and `status = 'approved'`
- Add migration: trigger function `sync_ebolovanje_to_leave_requests()`
- Update `EBolovanje.tsx`: after status change, invalidate `leave_requests` query cache

#### Step 3: Minuli rad in payroll (3h)
- **Migration**: Add `minuli_rad_years numeric DEFAULT 0` and `minuli_rad_amount numeric DEFAULT 0` columns to `payroll_items`
- **Migration**: Update `calculate_payroll_for_run` function:
  - Calculate years of service from `employees.start_date` (or `hire_date`) to period start
  - Compute `minuli_rad = 0.004 * years * gross_salary` (0.4% per year, per Zakon o radu cl. 108)
  - Add to gross before tax/contribution calculation
  - Store in new columns
- **Frontend**: Show minuli rad line in `Payroll.tsx` run detail accordion and payroll item table

#### Step 4: Otpremnina calculation + GL posting (4h)
- **Migration**: Create `severance_payments` table:
  - `id, tenant_id, employee_id, reason (retirement|redundancy|other), years_of_service, calculation_base, multiplier, total_amount, gl_posted, journal_entry_id, created_by, created_at`
- **Migration**: RLS policy (tenant isolation)
- **New page**: `src/pages/tenant/Otpremnina.tsx`
  - Calculate per Zakon o radu cl. 158: 1/3 average salary × years of service (minimum)
  - GL posting to account 5290 (Otpremnine) DR / 4500 CR
  - Table of all severance payments with status
- **Route**: Add to `hrRoutes.tsx` at `/hr/severance`
- **Sidebar**: Add to HR nav in `TenantLayout.tsx`

#### Step 5: KEP Knjiga (4h)
- **Migration**: Create `kep_entries` table:
  - `id, tenant_id, location_id, entry_date, entry_number, document_type, document_number, description, goods_value, services_value, total_value, payment_type (cash|card|transfer), created_at`
- **Migration**: RLS policy (tenant isolation)
- **New page**: `src/pages/tenant/KepKnjiga.tsx`
  - Daily retail sales register per location (Pravilnik o evidenciji prometa)
  - Auto-populate from POS transactions for selected location + date range
  - Running entry numbers, daily totals
  - Print/PDF/Export support
- **Route**: Add to `posRoutes` or `accountingRoutes` at `/accounting/kep`
- **Sidebar**: Add to accounting nav

#### Step 6: Popisna lista robe — Inventory Stock Take (4h)
- **Migration**: Create `inventory_stock_takes` table:
  - `id, tenant_id, location_id, warehouse_id, stock_take_date, status (draft|in_progress|completed|approved), commission_members text[], notes, created_by, approved_by, approved_at, created_at`
- **Migration**: Create `inventory_stock_take_items` table:
  - `id, stock_take_id, product_id, expected_qty, counted_qty, difference_qty, unit_cost, difference_value, notes`
- **Migration**: RLS policies
- **New page**: `src/pages/tenant/InventoryStockTake.tsx`
  - Create stock take for a location/warehouse
  - Enter counted quantities, auto-calculate differences
  - Commission protocol with member names
  - Approve → generates adjustment entries (surplus GL 6700 / shortage GL 5850)
  - Print popisna lista with legal format
- **Route**: Add to `inventoryRoutes` at `/inventory/stock-take`
- **Sidebar**: Add to inventory nav

#### Step 7: Otpisi robe — Write-offs with GL 585 (3h)
- **Migration**: Create `inventory_write_offs` table:
  - `id, tenant_id, location_id, warehouse_id, write_off_date, reason, commission_members text[], commission_protocol_number, status (draft|approved|posted), journal_entry_id, total_value, notes, created_by, approved_by, created_at`
- **Migration**: Create `inventory_write_off_items` table:
  - `id, write_off_id, product_id, quantity, unit_cost, total_cost, reason`
- **Migration**: RLS policies
- **New page**: `src/pages/tenant/InventoryWriteOff.tsx`
  - Create write-off with commission protocol
  - Select products + quantities from current stock
  - Approve → GL posting: DR 5850 (Rashodi po osnovu rashodovanja) / CR 1320 (Roba u magacinu)
  - Commission protocol PDF export
- **Route**: Add to `inventoryRoutes` at `/inventory/write-offs`
- **Sidebar**: Add to inventory nav

#### Step 8: APR AOP position mapping (2h, P1 — can defer)
- Create `apr_aop_mappings` table mapping account codes to AOP positions
- Update `generate-apr-xml` edge function to use mappings
- This is lower priority; can be done after the P0 items

---

### Technical Details

**Database migrations needed** (6 migrations):
1. `payroll_items` add columns + update `calculate_payroll_for_run` (minuli rad)
2. `sync_ebolovanje_to_leave_requests` trigger function
3. `severance_payments` table + RLS
4. `kep_entries` table + RLS
5. `inventory_stock_takes` + `inventory_stock_take_items` tables + RLS
6. `inventory_write_offs` + `inventory_write_off_items` tables + RLS

**New pages** (4):
- `Otpremnina.tsx`
- `KepKnjiga.tsx`
- `InventoryStockTake.tsx`
- `InventoryWriteOff.tsx`

**Modified files**:
- `BilansUspeha.tsx` (class 7 label fix)
- `Payroll.tsx` (show minuli rad column)
- `TenantLayout.tsx` (sidebar entries)
- `hrRoutes.tsx` / `inventoryRoutes.tsx` / `accountingRoutes.tsx` (new routes)
- `rolePermissions.ts` (if new modules need permission mapping)
- `GlobalSearch.tsx` (add new pages to search index)
- `translations.ts` (add SR/EN keys for new features)

**Implementation order** (respecting dependencies):
1. BilansUspeha fix (trivial, immediate)
2. eBolovanje sync bridge (unblocks payroll accuracy)
3. Minuli rad (payroll calculation fix)
4. Otpremnina (standalone HR feature)
5. KEP Knjiga (standalone accounting/POS feature)
6. Popisna lista (inventory)
7. Otpisi robe (inventory, similar pattern to #6)
8. APR AOP (if time permits)


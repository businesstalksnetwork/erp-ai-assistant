

# Fix All 36 CR Bugs — Implementation Plan

## Batch 1: CRITICAL Security (6 fixes)

### CR-06/CR-07: SEF Webhook auth + UUID enumeration
**File:** `supabase/functions/sef-webhook/index.ts`
- Line 22: Change `if (webhookSecret && ...)` → `if (!webhookSecret) return 401; if (providedSecret !== webhookSecret) return 401` (fail closed)
- Lines 63-67: Remove the `invoiceId` direct UUID lookup branch — only allow `sefId` via `sef_invoice_id`

### CR-14: NBS Cron auth fails open
**File:** `supabase/functions/nbs-daily-cron/index.ts`
- Line 22: Change `if (cronSecret && ...)` → `if (!cronSecret) return 401 "CRON_SECRET not configured"; if (authHeader !== ...) return 401`

### CR-13/CR-16: CROSO uses anon key + .single() leaks
**File:** `supabase/functions/generate-croso-xml/index.ts`
- Line 27: Change `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- Line 80: Change `.single()` on legal_entities to `.maybeSingle()` with fallback
- Add `<OsnovaOsiguranja>` and `<SifraPlacanja>` tags to M-1 XML

### CR-24: Delete mutations missing tenant_id scope
**Files:** `TaxLossCarryforward.tsx` (line ~75), `DeferredTax.tsx` (line ~76), `IntercompanyEliminations.tsx` (line ~80)
- Add `.eq("tenant_id", tenantId!)` to every `deleteMutation`

### CR-17: generate-payment-orders has no authentication
**File:** `supabase/functions/generate-payment-orders/index.ts`
- Add JWT auth + tenant membership verification at top

---

## Batch 2: CRITICAL Data Integrity (8 fixes)

### CR-08/CR-09: Production waste GL always = 0
**File:** `src/pages/tenant/ProductionOrderDetail.tsx` (line 123)
- Fix operator precedence: wrap `products.find(...)?.default_purchase_price || 0` in parentheses
- Line 123: `const wasteValue = wasteForm.quantity * ((products.find((p: any) => p.id === wasteForm.product_id) as any)?.default_purchase_price || 0);`

### CR-11/CR-12: TaxLossCarryforward keystroke race + no validation
**File:** `src/pages/tenant/TaxLossCarryforward.tsx`
- Replace `onChange` mutation on used_amount Input with local state + debounced save (use `useDebounce`)
- Add validation: `used_amount <= loss_amount`, show error if exceeded

### CR-14: DeferredTax Math.abs() strips DTA/DTL sign
**File:** `src/pages/tenant/DeferredTax.tsx` (line ~54)
- Remove `Math.abs()` from `deferred_tax_amount` calculation
- Use signed value: `diff * form.tax_rate` (positive = DTA, negative = DTL)
- Fix DTA/DTL totals to use absolute values only for display

### CR-13: IntercompanyEliminations — no GL posting path
**File:** `src/pages/tenant/IntercompanyEliminations.tsx`
- Add a "Proknjiži" (Post) button per row that calls `postWithRuleOrFallback` with elimination type-specific accounts
- Update status to "posted" after successful GL entry
- Validate `entity_from_id !== entity_to_id` in add mutation

### CR-23/CR-28: ThinCapitalization stale closure + equity=0
**File:** `src/pages/tenant/ThinCapitalization.tsx`
- Add `useEffect` to sync local state (debt, equity, interest) from query data when record loads
- Use local state in save mutation (not the stale `effectiveX` values)
- Fix equity=0: return `Infinity` for ratio display, show "Beskonačno" badge

### CR-25/CR-26: VatProRata stale closure + queryKey missing year
**File:** `src/pages/tenant/VatProRata.tsx`
- Add `year` to queryKey: `["vat-prorata", tenantId, year]`
- Add `useEffect` to sync local state from query data
- Use local state in save mutation

### CR-05: compliance-checker RPC signature mismatch
**File:** `supabase/functions/compliance-checker/index.ts`
- All calls to `execute_readonly_query` pass `{ query_text: ... }` — verify the RPC accepts this signature
- If RPC now requires `tenant_id_param`, add it to all calls

### CR-04: Payroll duplicate employer contribution columns
**Requires:** New SQL migration
- Fix the INSERT statement in payroll RPC to remove duplicate `pio_employer, health_employer, unemp_employer` columns

---

## Batch 3: HIGH Priority (12 fixes)

### CR-10: Wrong Serbian law article references
**Files:** 4 pages
- `TaxLossCarryforward.tsx`: "čl. 32-38" → "čl. 32"
- `ThinCapitalization.tsx`: "čl. 61-63" → "čl. 61"
- `VatProRata.tsx`: "čl. 30" → "čl. 31"
- `CapitalGoodsVatRegister.tsx`: "čl. 32" → "čl. 32a"

### CR-21: MultiPeriodReports Class 2 still in AKTIVA
**File:** `src/pages/tenant/MultiPeriodReports.tsx` (lines 75-84)
- Change `["0", "1", "2"]` → `["0", "1"]` for assets
- Add Class 2 to liabilities: `["2", "4"]`
- Update labels accordingly

### CR-22/CR-29: SupplierInvoices payment account 2100 → 2200
**File:** `src/pages/tenant/SupplierInvoices.tsx` (line 258)
- Change `accountCode: "2100"` → `"2200"`

### CR-15: SEF S10/S20 uses wall clock not invoice date
**File:** `supabase/functions/sef-send-invoice/index.ts`
- Pass invoice's `issue_date` to `determineVatCategory` instead of `new Date()`

### CR-34: CapitalGoods pro-rata inputs unbounded
**File:** `src/pages/tenant/CapitalGoodsVatRegister.tsx` (lines 105, 109)
- Add `min={0} max={1} step={0.01}` to pro-rata input fields
- Add validation before save: `original_prorata >= 0 && original_prorata <= 1`

### CR-36: foreignPerDiemRates wrong regulation year
**File:** `src/data/foreignPerDiemRates.ts` (line 3)
- Change `"Sl. glasnik RS, br. 10/2022"` → `"Sl. glasnik RS, br. 76/2024"`

### CR-35: Invoices.tsx duplicate MobileFilterBar
**File:** `src/pages/tenant/Invoices.tsx` (lines 398-424)
- Remove the second duplicate `<MobileFilterBar>` block

### CR-31/CR-32: CROSO XML namespace + missing tags
**File:** `supabase/functions/generate-croso-xml/index.ts`
- Replace `urn:croso.gov.rs:m1` → `urn:croso:m-forms:v1` (or actual CROSO namespace when available)
- Add `<OsnovaOsiguranja>01</OsnovaOsiguranja>` to M-1 XML
- Add `<SifraPlacanja>240</SifraPlacanja>` for salary

### CR-33: generate-apr-xml builder chaining bug
**File:** `supabase/functions/generate-apr-xml/index.ts`
- Fix immutable builder: assign result of `.eq()` back to query variable

### CR-27: KpoBook selects wrong column name
**File:** `src/pages/tenant/KpoBook.tsx`
- Verify column name `total_amount` exists on invoices/supplier_invoices tables (it does per the select query found — no fix needed if column exists)

### CR-30: SQL injection in compliance-checker
**File:** `supabase/functions/compliance-checker/index.ts` (line 197)
- `vatAccount.id` is from our own DB query result (UUID), but wrap in parameterized query or validate UUID format

---

## Batch 4: DB Migration Fixes (3 fixes)

### CR-01: execute_readonly_query regression
**New migration** to restore hardening:
- Re-add system schema blocks (`pg_catalog`, `information_schema`)
- Re-add UNION/UNION ALL blocks
- Re-add LIMIT injection protection
- Restore the stricter regex

### CR-02: Invoice double-post guard NULL-clearing bypass
**New migration:**
- Fix trigger: check `OLD.journal_entry_id IS NOT NULL` regardless of NEW.status

### CR-15b: cit_advance_payments RLS — no policy created
**New migration:**
- Add RLS policy for `cit_advance_payments` using `get_user_tenant_ids()`

### CR-15c: RLS policies use slow inline subquery
**New migration:**
- Replace inline subqueries in all 6 new table policies with `get_user_tenant_ids(auth.uid())`

### CR-28b: Thin cap ratio = 0 when equity = 0
**New migration:**
- Change generated column: `CASE WHEN equity_amount > 0 THEN ... ELSE NULL END`

### CR-28c: deferred_tax_amount not generated
- Keep as regular column (computed client-side on insert) — document this is intentional since it depends on user-provided tax_rate

---

## Summary

- **Files modified:** ~18 (6 feature pages, 4 edge functions, 2 report pages, 1 data file, 1 invoices page, 1 compliance-checker, 1 production page, 1 supplier invoices)
- **New SQL migration:** 1 (restoring security hardening, fixing RLS, fixing triggers)
- **Edge functions to redeploy:** sef-webhook, nbs-daily-cron, generate-croso-xml, compliance-checker, sef-send-invoice, generate-apr-xml, generate-payment-orders


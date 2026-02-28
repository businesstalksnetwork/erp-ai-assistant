

# Batch 4: DB Migrations + Remaining Fixes

## 1. Fix `execute_readonly_query` hardening (CR-01)
**New SQL migration** to restore security features stripped in the last rewrite:
- Block system schema access (`pg_catalog`, `information_schema`)
- Block `UNION` / `UNION ALL` to prevent query chaining
- Add forced `LIMIT 100` if no LIMIT clause present
- Keep the existing tenant membership check and `SET LOCAL statement_timeout`

## 2. Fix invoice double-post trigger (CR-02)
**Same migration** — update `guard_invoice_double_post` trigger:
- Also block clearing `journal_entry_id` to NULL once set: `IF OLD.journal_entry_id IS NOT NULL AND (NEW.journal_entry_id IS NULL OR NEW.journal_entry_id != OLD.journal_entry_id) THEN RAISE EXCEPTION`

## 3. Fix RLS policies — use `get_user_tenant_ids()` (CR-15c)
**Same migration** — DROP and recreate all 6 new table policies to use `get_user_tenant_ids(auth.uid())` instead of inline subquery:
- `tax_loss_carryforward`
- `thin_capitalization`
- `vat_prorata_coefficients`
- `capital_goods_vat_register`
- `deferred_tax_items`
- `intercompany_eliminations`

## 4. Fix thin_capitalization generated column for equity=0 (CR-28b)
**Same migration** — ALTER the `debt_equity_ratio` generated column:
- `CASE WHEN equity_amount > 0 THEN related_party_debt / equity_amount ELSE NULL END`

## 5. Fix compliance-checker RPC calls (CR-05)
**File:** `supabase/functions/compliance-checker/index.ts`
- Add `tenant_id_param: tenantId` to ALL 7 `execute_readonly_query` RPC calls (lines 43, 192, 202, 237, 322, 354, 386)
- The function already has `tenantId` in scope from the request body

## 6. Remove duplicate MobileFilterBar in Invoices (CR-35)
**File:** `src/pages/tenant/Invoices.tsx`
- Delete lines 398-424 (the second identical `<MobileFilterBar>` block)

## 7. Fix SEF `determineVatCategory` wall clock usage (CR-15)
**File:** `supabase/functions/sef-send-invoice/index.ts`
- Line 83 already accepts `invoiceDate` parameter and uses it correctly
- The `generateUBLXml` call at line 96 passes `invoice.issue_date` — verify callers pass this. **No code change needed** if the function already receives `invoiceDate` from callers.

## Summary
- **1 SQL migration** with 4 schema fixes (execute_readonly_query, trigger, RLS policies, generated column)
- **2 files edited**: compliance-checker/index.ts, Invoices.tsx
- **Edge functions to redeploy**: compliance-checker


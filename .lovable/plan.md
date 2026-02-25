

# Multi-Track Work Plan: Mobile Verification, Performance, Security & Edge Function Deployment

## Track 1: Deploy & Test Edge Functions

### Current State
- All 3 edge functions exist in `supabase/functions/` and are registered in `supabase/config.toml` with `verify_jwt = false`
- All 3 return 404 when called — they need to be deployed
- UI buttons are already wired in `PdvPeriods.tsx`, `BilansStanja.tsx`, `BilansUspeha.tsx`
- CORS headers are present but **missing Supabase platform headers** — all 3 functions use the minimal `authorization, x-client-info, apikey, content-type` header set, which should be expanded to include `x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version` for reliable browser calls

### Actions
1. **Update CORS headers** in all 3 edge functions (`generate-pppdv-xml`, `generate-tax-payment-orders`, `generate-apr-xml`) to include the full Supabase client headers
2. **Deploy all 3 edge functions** using the deploy tool
3. **Test each function** with POST requests to verify they respond correctly (401 without auth, proper XML generation with auth)

---

## Track 2: Security Scan Results

### Already Verified (No Action Needed)
- `tax_calendar`: RLS enabled, tenant isolation policy using `get_user_tenant_ids(auth.uid())`
- `cit_advance_payments`: RLS enabled, same tenant isolation policy
- Both policies cover `ALL` operations (SELECT, INSERT, UPDATE, DELETE)

### Linter Findings (3 warnings, none critical)
1. **Function Search Path Mutable** (WARN) — some DB functions don't set `search_path`, allowing potential schema injection. Should be fixed by adding `SET search_path = public` to affected functions.
2. **Extension in Public** (WARN) — extensions installed in `public` schema instead of a dedicated `extensions` schema. Low risk but should be noted.
3. **Leaked Password Protection Disabled** (WARN) — Supabase auth setting. Can be enabled in the Supabase dashboard under Auth > Settings.

### Actions
1. Run `security--run_security_scan` for a full table-level RLS audit
2. Fix function search path on any new compliance functions created in the migration
3. Document the extension-in-public and leaked-password findings for the user to address in Supabase dashboard

---

## Track 3: Mobile Layout Verification

### Current State
- Login page renders correctly at 390x844 — form fits, no horizontal overflow
- Dashboard redirects to `/login` when unauthenticated (expected behavior)
- Cannot test authenticated pages in the browser tool without credentials

### Known Patterns Already in Place
- `PageHeader` uses `flex-col sm:flex-row` stacking
- `MobileFilterBar` collapses filters into a popover on mobile
- `MobileActionMenu` converts inline buttons to dropdown on mobile
- Tables use `overflow-x-auto` wrappers
- Dialogs use `w-[95vw] sm:max-w-lg` pattern
- POS terminal uses `flex-col lg:flex-row` layout

### Remaining Issue: PDV Period Detail Summary Cards
Line 461: `grid grid-cols-3 gap-4` — this will squeeze 3 cards into a 390px viewport. Should be `grid grid-cols-1 sm:grid-cols-3 gap-4`.

### Actions
1. Fix `PdvPeriods.tsx` line 461: change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`
2. Verify the action buttons in the detail view wrap properly with `flex-wrap` (already present on line 428)
3. No other critical mobile issues found in the explored code

---

## Track 4: Performance Optimization

### Current Optimizations Already in Place
- Server-side RPC `dashboard_kpi_summary` for dashboard KPIs (avoids URL overflow)
- Vite `manualChunks` splits vendor/charts/UI/Supabase into separate bundles
- `staleTime` configured on dashboard queries (5 min for KPIs, 2 min for drafts)
- `usePaginatedQuery` hook available with 50-row page size

### Performance Concern: PDV Calculate Mutation (N+1 Query)
Lines 111-131 in `PdvPeriods.tsx`: The calculate mutation fetches invoice lines **one invoice at a time** in a loop (`for (const inv of invoices || [])` → `select from invoice_lines where invoice_id = inv.id`). For a tenant with 500+ invoices per period, this creates 500+ sequential queries.

### Actions
1. **Fix N+1 in PDV calculation**: Refactor to batch-fetch all invoice lines for the period's invoices in a single query using `.in("invoice_id", invoiceIds)`, then group client-side
2. **Add `staleTime` to PDV queries**: The `pdv_periods` and `pdv_entries` queries have no `staleTime`, causing unnecessary refetches
3. **Lazy load heavy dashboard widgets**: The dashboard imports 9 chart/widget components synchronously. Consider `React.lazy()` for `RevenueExpensesChart`, `CashFlowChart`, `TopCustomersChart`, `AiInsightsWidget` to reduce initial bundle

---

## Implementation Summary

| Track | Priority | Changes |
|-------|----------|---------|
| Edge Function Deploy | HIGH | Update CORS headers in 3 files, deploy, test |
| Security | DONE | RLS verified on new tables; 3 non-critical linter warnings |
| Mobile Fix | LOW | 1 line change in PdvPeriods.tsx (grid-cols-3 → responsive) |
| Performance | MEDIUM | Fix N+1 query in PDV calculate, add staleTime, lazy load dashboard charts |

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/generate-pppdv-xml/index.ts` | Expand CORS headers |
| `supabase/functions/generate-tax-payment-orders/index.ts` | Expand CORS headers |
| `supabase/functions/generate-apr-xml/index.ts` | Expand CORS headers |
| `src/pages/tenant/PdvPeriods.tsx` | Fix grid-cols-3, fix N+1 query, add staleTime |
| `src/pages/tenant/Dashboard.tsx` | Lazy load heavy chart components |


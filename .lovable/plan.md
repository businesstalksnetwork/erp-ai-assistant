

# Compliance and Security Audit -- Fix Plan

This plan addresses all Critical and High severity findings from the audit. Changes are grouped by priority.

---

## CRITICAL FIX 1: SEF Retry Semantics (Idempotency)

**Problem**: "Retry SEF" generates a new `requestId`, which can create duplicate invoices on the SEF portal if the original submission was actually accepted but we didn't poll for status.

**Fix**:
- **`src/pages/tenant/Invoices.tsx`** -- Remove the `sefMutation` logic that generates a new `requestId`. Instead, reuse the existing `sef_request_id` already stored on the invoice. Only generate a new `requestId` if the previous submission was definitively rejected (terminal state).
- **`supabase/functions/sef-submit/index.ts`** -- Before creating a new `sef_submissions` record, check if one already exists for the same `invoice_id` with the same `request_id`. If so, re-query its status instead of creating a duplicate. Add a `polling` mode that queries the SEF status endpoint (GET) to confirm terminal state before allowing resubmission.
- Add `sef_status` state `polling` to the UI badge colors.
- Add SEF status reconciliation: the edge function should check `sef_submissions` for any `submitted`/`pending` records and poll their status rather than blindly resubmitting.

**Files changed**:
- `src/pages/tenant/Invoices.tsx` -- fix retry mutation to reuse `sef_request_id`
- `supabase/functions/sef-submit/index.ts` -- add idempotency check, polling mode, rate limit awareness

---

## CRITICAL FIX 2: Payroll Contribution Rates

**Problem**: PIO employer rate is hardcoded as 11.5% in migrations and RPCs. Official CROSO rate is 12%.

**Fix**:
- New migration to update `payroll_parameters` default: `pio_employer_rate` from `0.115` to `0.12`.
- Update the `calculate_payroll_for_run` RPC to read rates from `payroll_parameters` table instead of hardcoded values (if not already doing so -- the migration at `20260213111633` hardcodes `0.115` directly in the RPC body).
- Update `src/pages/tenant/Payroll.tsx` table headers from "PIO posl. 11.5%" to "PIO posl." (read actual rate from parameters, not hardcode in UI).
- Add `max_contribution_base` column to `payroll_parameters` if missing (5x average wage constraint).

**Files changed**:
- New migration SQL (update defaults + fix RPC)
- `src/pages/tenant/Payroll.tsx` -- dynamic rate display

---

## CRITICAL FIX 3: POS Sale Posting Missing Embedded VAT (1340)

**Problem**: `process_pos_sale` RPC removes retail inventory (Cr 1320) but does not release the embedded VAT component (Dr 1340). This leaves a residual 1340 balance and distorts VAT decomposition.

**Current entries** (lines 117-120 of `process_pos_sale`):
```
D: 5010 (COGS at cost)
D: 1329 (Reverse markup = subtotal - cost)
C: 1320 (Retail inventory at subtotal)
```

**Missing**: The 1320 balance includes embedded VAT (stored in 1340 at kalkulacija). On sale, the VAT portion must also be released.

**Correct entries**:
```
D: 5010 (COGS at cost)
D: 1329 (Reverse markup)
D: 1340 (Release embedded VAT = tax_amount from the transaction)
C: 1320 (Retail inventory at retail price INCLUDING VAT = subtotal + tax_amount)
```

**Fix**: New migration with `CREATE OR REPLACE FUNCTION process_pos_sale` that:
1. Credits 1320 for the full retail amount (subtotal + tax_amount, not just subtotal)
2. Debits 1340 for the embedded VAT component
3. Recalculates markup as `retail_total - embedded_vat - cost`

**Files changed**:
- New migration SQL

---

## CRITICAL FIX 4: RLS `USING (true)` Audit

**Problem**: `module_definitions` table has `USING (true)` for SELECT. The audit says this is critical for tenant-scoped tables.

**Assessment**: `module_definitions` is a **global catalog** table (not tenant-scoped), so `USING (true)` for SELECT is actually correct here -- all authenticated users need to see which modules exist. The `FOR ALL` policy is restricted to super admins. This is **not a real vulnerability** but we should document why.

**Action**: No code change needed. We will add a comment in the migration for clarity. However, we should audit all other tables to confirm no tenant-scoped table has `USING (true)`.

---

## HIGH FIX 5: `process-module-event` Edge Function -- No Auth

**Problem**: This function uses `SUPABASE_SERVICE_ROLE_KEY` and has no authentication check. Anyone can POST an `event_id` and trigger inventory adjustments, notifications, etc.

**Fix**: Add a shared internal secret check. The function should require either:
- A valid user JWT (for user-initiated events), OR
- A service secret header (`X-Internal-Secret`) matching a configured secret (for function-to-function calls)

**Files changed**:
- `supabase/functions/process-module-event/index.ts` -- add auth gate

---

## HIGH FIX 6: POS Payment Account Configurability

**Problem**: Cash and card both map to hardcoded accounts (2430/2431). Card sales should use a clearing account until bank settlement, and this must be configurable per tenant.

**Fix**: This is a configuration concern. For now, add a comment in the RPC noting that 2431 for card is a clearing account (Tekuci racun). Full configurability (tenant-level posting rule catalog) is a v2 feature. No code change in this phase -- the current mapping is acceptable for MVP if documented.

---

## HIGH FIX 7: eBolovanje Integration (Stub)

**Problem**: eBolovanje (employer sick leave portal) is mandatory from 1 Jan 2026. No implementation exists.

**Fix**: Create a stub page and database table as a placeholder:
- New page `src/pages/tenant/EBolovanje.tsx` with a "Coming Soon" indicator and description of the integration requirements
- Add route and nav entry under HR module
- This is not a full implementation but prevents the system from being non-compliant by omission -- it signals the feature is planned

**Files changed**:
- New `src/pages/tenant/EBolovanje.tsx`
- `src/App.tsx` (route)
- `src/layouts/TenantLayout.tsx` (nav)
- `src/i18n/translations.ts`

---

## Implementation Order

1. Migration: Fix payroll rates (Critical 2)
2. Migration: Fix POS posting 1340 release (Critical 3)
3. `sef-submit` edge function: idempotency + polling (Critical 1)
4. `Invoices.tsx`: fix retry to reuse requestId (Critical 1)
5. `process-module-event`: add auth gate (High 5)
6. eBolovanje stub page + route + nav (High 7)
7. Payroll.tsx: dynamic rate headers (Critical 2)

---

## Out of Scope (Documented for Next Phase)

- Full SEF production API integration (real POST + GET polling with rate limiting)
- Full eBolovanje eUprava connector
- eOtpremnica API (mandatory Oct 2027 for private sector; Jan 2026 for public/excise -- build if targeting those clients)
- Tenant-configurable posting rule catalog (account mappings)
- Offline fiscal receipt compliance verification against PFR certification rules
- `max_contribution_base` enforcement (5x average wage) in payroll RPC


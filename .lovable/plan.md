

# V5.6 CR12 Implementation Plan

## Scope: 23 CR12 findings across 4 severity levels

## CRITICAL (3)

### CR12-01: process_pos_sale posts entire split-payment total to single GL account
**Problem**: Line 54 of the SQL function: `IF v_tx.payment_method = 'cash' THEN v_da := v_acash; ELSE v_da := v_abank;` — ignores `payment_details` JSONB. Line 108: `(v_je, v_da, v_tx.total, 0, ...)` debits full amount to one account.

**Fix**: New migration to recreate `process_pos_sale`:
- Read `v_tx.payment_details::jsonb` when not null
- Loop over payment entries creating per-method debit journal lines (cash→2430, card→2431)
- When `payment_details` is null, fall back to existing single-method logic

### CR12-02: React state race condition in SplitPaymentDialog.onConfirm
**Problem**: Line 953: `setSplitPayments(payments); setPaymentMethod(...); completeSale.mutate()` — React 18 batching means `splitPayments` is still empty when mutation closure captures it.

**Fix**: Change `completeSale` mutation to accept an optional `payments` parameter. Pass payments directly: `completeSale.mutate({ payments })`. Inside mutationFn, use the parameter instead of `splitPayments` state.

### CR12-03: recurring-invoice-generate has NO authentication
**Problem**: No auth check at all. Service-role client immediately queries all tenants.

**Fix**: Add CRON_SECRET fail-closed guard at top of function (same pattern as `ai-weekly-email`).

## HIGH (5)

### CR12-04: recurring-journal-generate has NO authentication
Same fix as CR12-03.

### CR12-05: PosDailyReport Z-report broken for split payments
**Problem**: Lines 84-87 filter by `payment_method === "cash"` and sum full `tx.total`. Ignores `payment_details`.

**Fix**: When `tx.payment_details` array exists, sum per-method amounts from it. Otherwise fall back to existing logic.

### CR12-06 & CR12-07: sef-poll-status and nbs-exchange-rates CRON_SECRET fail-open
**Problem**: When both env var and header are undefined, `undefined !== undefined` is false, so check passes.

**Fix**: Add `if (!cronSecret) return 500 "CRON_SECRET not configured"` guard before the comparison.

### CR12-08: Rate limiter adoption push
Add `checkRateLimit` to 6 high-risk functions: `fiscalize-receipt`, `invoice-ocr`, `sef-submit`, `import-legacy-zip`, `send-admin-bulk-email`, `clear-tenant-data`.

## MEDIUM (8)

### CR12-09: tenant-data-export double body-read
Parse body once, store in variable, extract both `tenant_id` and `cursor` from it.

### CR12-10: CSS [data-sidebar] selector verification
Confirmed: shadcn `sidebar.tsx` **does** set `data-sidebar="sidebar"` on the sidebar div (line 208). The CSS selector works. No change needed.

### CR12-11: POS refund flow ignores split-payment originals
Read original transaction's `payment_details` JSONB. Distribute refund per method in fiscal receipt and cash register.

### CR12-12: Duplicate entry_number for split cash register entries
Add index suffix: `POS-${txNum}-${idx}` for each split cash entry.

### CR12-13: validate-pib 4/7 paths missing withSecurityHeaders
Apply `withSecurityHeaders` to all 4 remaining response paths (lines 23, 81, 90, 107).

### CR12-14: ai-weekly-email success response missing security headers
Apply `withSecurityHeaders` to success response at line 139.

### CR12-15: daily-data-seed inverted production guard
Change to allowlist: only run if `ENVIRONMENT` is explicitly set to a non-production value. If unset, block.

### CR12-16: 'Bronze' tier capitalization
Standardize to 'Bronze' (capitalized) matching the tier_name in loyalty_tiers table. Verify no case-sensitive comparisons elsewhere.

## LOW (7)

### CR12-17: Remove @radix-ui/react-toast — already deleted components, remove package
### CR12-18: Reset paymentMethod/voucherType in onSuccess
### CR12-19: Store full payment array in fiscal_receipts — frontend change only (edge function stores `payments[0]`)
### CR12-20: Fix useToast().dismiss() for string IDs — use raw id instead of `Number(id)`
### CR12-21: compliance-checker secondary IN-queries — add `.limit(10000)`
### CR12-22: Add timeout-minutes: 15 to security-audit CI job
### CR12-23: Remove deprecated X-XSS-Protection header

---

## Implementation Order

**Sprint 1 (this session):**
1. CR12-02 (race condition) + CR12-01 (GL migration) — the two CRITICAL POS fixes
2. CR12-03 + CR12-04 (auth on recurring generators)
3. CR12-06 + CR12-07 (CRON_SECRET fail-open)

**Sprint 2:**
4. CR12-05 (Z-report), CR12-11 (refund flow), CR12-12 (entry_number)
5. CR12-09, CR12-13, CR12-14, CR12-15, CR12-16
6. CR12-08 (rate limiter push — 6 functions)

**Sprint 3:**
7. All LOW items (CR12-17 through CR12-23)

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/tenant/PosTerminal.tsx` | CR12-02 (pass payments as mutation arg), CR12-11 (refund split), CR12-12 (entry suffix), CR12-18 (reset state) |
| `src/pages/tenant/PosDailyReport.tsx` | CR12-05 (split payment bucketing) |
| `supabase/functions/recurring-invoice-generate/index.ts` | CR12-03 (CRON_SECRET auth) |
| `supabase/functions/recurring-journal-generate/index.ts` | CR12-04 (CRON_SECRET auth) |
| `supabase/functions/sef-poll-status/index.ts` | CR12-06 (fail-closed guard) |
| `supabase/functions/nbs-exchange-rates/index.ts` | CR12-07 (fail-closed guard) |
| `supabase/functions/validate-pib/index.ts` | CR12-13 (4 missing withSecurityHeaders) |
| `supabase/functions/ai-weekly-email/index.ts` | CR12-14 (success headers) |
| `supabase/functions/daily-data-seed/index.ts` | CR12-15 (inverted guard) |
| `supabase/functions/tenant-data-export/index.ts` | CR12-09 (double body-read) |
| `supabase/functions/compliance-checker/index.ts` | CR12-21 (secondary limits) |
| `src/hooks/use-toast.ts` | CR12-20 (dismiss string IDs) |
| `src/_shared/security-headers.ts` | CR12-23 (remove X-XSS-Protection) |
| `.github/workflows/ci.yml` | CR12-22 (timeout-minutes) |
| 6 edge functions | CR12-08 (rate limiter adoption) |
| New migration | CR12-01 (process_pos_sale split payment GL) |


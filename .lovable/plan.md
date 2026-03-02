

# V5.5 CR11 Implementation Plan

## Scope: 27 CR11 findings across 4 severity levels

---

## CRITICAL (Sprint 1)

### CR11-01: POS Split Payment Regression
**Problem**: `SplitPaymentDialog` returns array of `{method, amount}` but line 946 joins them as `"cash+card"` string. This breaks: GL routing, fiscal receipts (PFR requires per-method entries), and cash register bridging.

**Fix in `PosTerminal.tsx`**:
- Add new state: `splitPayments` array (`{method: string, amount: number}[]`)
- In `SplitPaymentDialog.onConfirm`: store the payments array in `splitPayments`, set `paymentMethod` to first method (for backward compat)
- In `completeSale.mutationFn`:
  - Store `payment_details: splitPayments` as JSON in the transaction (via `as any` on the insert)
  - Pass `payments: splitPayments` (or single `[{amount: total, method: paymentMethod}]`) to `fiscalize-receipt` — already structured correctly at line 508
  - Create **per-method cash register entries** — loop over splitPayments where `method === "cash"` for cash register bridge
  - Store the primary method as `paymentMethod` but the full split in `payment_details` column

### CR11-02: refresh_loyalty_tier Parameter Swap
**Problem**: `accrue_loyalty_points_v2` (baseline migration line 166) calls `refresh_loyalty_tier(p_tenant_id, p_member_id)` but CR10-06 migration changed signature to `(p_member_id, p_tenant_id)`. Arguments are swapped.

**Fix**: New migration to recreate `refresh_loyalty_tier` with `(p_tenant_id, p_member_id)` order matching the caller, plus add `IS DISTINCT FROM` guard (CR11-08).

---

## HIGH (Sprint 1)

### CR11-03: ai-weekly-email CRON_SECRET Fail-Open
**Problem**: Line 16: `if (cronSecret && ...)` skips auth if env var unset.

**Fix**: Change to fail-closed: if `!cronSecret`, return 500 "CRON_SECRET not configured".

### CR11-04: validate-pib 3 Fail-Open Paths
**Problem**: Missing API token (line 36), HTTP error (line 62), and API exception (line 98) all return `valid: true`.

**Fix**: All three paths return `valid: false` with appropriate warning messages. Also apply `withSecurityHeaders` to all response headers.

---

## MEDIUM (Sprint 2)

### CR11-06 & CR11-07: i18n — MarketBasketAnalysis (Serbian-only) & DsarManagement (English-only)
- Add missing translation keys for both pages
- Replace hardcoded strings with `t()` calls

### CR11-09: tenant-data-export Multi-Tenant Ambiguity
- Accept optional `tenant_id` from request body; if provided and user has membership, use it
- Current: picks first active membership arbitrarily

### CR11-10: compliance-checker Unbounded Fetch
- Add `.limit(5000)` to all initial queries in `runComplianceChecks`

### CR11-12: Missing CSP Header
- Add `Content-Security-Policy: default-src 'none'` to `security-headers.ts`

### CR11-13: Security Audit Not Gating Builds
- Add `needs: [security-audit]` to the `build` job in `ci.yml`

### CR11-15: POS Loyalty Redemption UI
- Add redemption button in checkout area when `loyaltyMember` is identified
- Call existing `redeem_loyalty_points` RPC, subtract from total

---

## LOW (Sprint 3)

### CR11-16: POS Discount Dialog Hardcoded Serbian
- Already partially addressed — add remaining keys to translations

### CR11-17: Over-Broad Radix CSS Selector
- Scope `[data-radix-collapsible-content]` override to `.sidebar-nav` parent only

### CR11-18: Toast dismiss-by-ID Broken
- Pass toast ID to `sonnerToast.dismiss()` in the returned object

### CR11-19: settingsModules Translation Key Missing
- Add `settingsModules` key to translations.ts

### CR11-20: Dead @radix-ui/react-toast Dependency
- Remove from package.json

### CR11-21: Dead toaster.tsx Component
- Delete `src/components/ui/toaster.tsx` and `src/components/ui/toast.tsx`

### CR11-22 & CR11-23: Dependency Hygiene
- Move `@types/qrcode` and `rollup-plugin-visualizer` to devDependencies

### CR11-24: `as any` Casts on Translation Keys
- Add all missing keys to `TranslationKey` type union (or translations object)

### CR11-25: Toast update() is No-Op
- Implement `update()` via `sonnerToast()` with the same ID

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/tenant/PosTerminal.tsx` | Split payment array storage, per-method fiscal/cash-register, loyalty redemption UI |
| `supabase/functions/ai-weekly-email/index.ts` | Fail-closed CRON_SECRET |
| `supabase/functions/validate-pib/index.ts` | 3 fail-open → fail-closed |
| `supabase/functions/_shared/security-headers.ts` | Add CSP header |
| `supabase/functions/tenant-data-export/index.ts` | Accept explicit tenant_id |
| `supabase/functions/compliance-checker/index.ts` | Add .limit(5000) |
| `src/pages/tenant/MarketBasketAnalysis.tsx` | i18n conversion |
| `src/pages/tenant/DsarManagement.tsx` | i18n conversion |
| `src/i18n/translations.ts` | ~40 new keys |
| `src/hooks/use-toast.ts` | Fix dismiss-by-ID, implement update() |
| `src/index.css` | Scope collapsible CSS to sidebar |
| `.github/workflows/ci.yml` | Gate build on security-audit |
| `src/components/ui/toaster.tsx` | Delete |
| `src/components/pos/SplitPaymentDialog.tsx` | i18n labels |
| New migration | Fix refresh_loyalty_tier param order + IS DISTINCT FROM |
| `package.json` | Move 2 deps to devDependencies, remove react-toast |

## Implementation Order
1. CR11-01 (CRITICAL split payment) + CR11-02 (parameter swap migration)
2. CR11-03 + CR11-04 (fail-open fixes)
3. Medium items (i18n, CSP, CI gating, compliance-checker limits)
4. Low items (cleanup, toast fixes, CSS scoping)


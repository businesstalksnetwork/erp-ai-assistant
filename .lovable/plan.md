
# Comprehensive Compliance Recheck -- Gap Analysis

Based on a line-by-line audit of all current files against the compliance document, here is the status of every issue raised and the fixes still needed.

---

## STATUS MATRIX: What's Fixed vs What's Still Broken

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chart of Accounts (Anglo-Saxon to Serbian) | FIXED | Seed function uses Pravilnik 89/2020 codes (0100-9100). Old codes marked inactive. |
| 2 | Invoice posting accounts (2040/6010/2470) | FIXED | `process_invoice_post` RPC uses correct Serbian accounts with COGS. |
| 3 | POS journal entries + inventory | FIXED | `process_pos_sale` RPC creates Revenue/VAT/COGS entries and deducts inventory. |
| 4 | Maloprodaja 1320/1329 logic | PARTIAL | Kalkulacija/Nivelacija RPCs exist (`post_kalkulacija`/`post_nivelacija`). Missing: embedded VAT account ("ukalkulisani PDV u prometu na malo"). |
| 5 | Payroll nontaxable = 34,221 RSD | FIXED | `calculate_payroll_for_run` uses `GREATEST(v_gross - 34221, 0)`. |
| 6 | Payroll 6 contribution lines | FIXED | Separate PIO/Health/Unemployment employee + PIO/Health employer columns and journal lines. |
| 7 | Payroll min/max contribution bases | NOT FIXED | No `payroll_parameters` table. Rates hardcoded. No min (51,297) / max (732,820) base enforcement. |
| 8 | FixedAssets account codes | FIXED | Uses 0121, 0120, 5310, 6072, 5073, 2431. |
| 9 | Loans account codes | FIXED | Uses 4200, 5330, 2431, 2040, 6020. |
| 10 | Deferrals account codes | FIXED | Uses 4600, 6010, 5400, 1500. |
| 11 | FxRevaluation account codes | FIXED | Uses 6072, 5072, 2040, 4350. |
| 12 | Kompenzacija account codes | FIXED | Uses 4350, 2040. |
| 13 | Edge Functions JWT (create-tenant) | FIXED | Has `getUser()` + `is_super_admin` check. |
| 14 | Edge Functions JWT (fiscalize-receipt) | FIXED | Has `getUser()` auth check. |
| 15 | Edge Functions JWT (sef-submit) | FIXED | Has `getUser()` auth check. |
| 16 | Edge Functions JWT (generate-pdf) | FIXED | Has `getUser()` + tenant membership check. |
| 17 | Edge Functions JWT (ai-assistant) | FIXED | Has `getUser()` auth check. |
| 18 | Edge Functions JWT (ai-insights) | FIXED | Has `getUser()` auth check. |
| 19 | Edge Functions JWT (create-notification) | FIXED | Has `getUser()` auth check. |
| 20 | web-order-import HMAC validation | FIXED | Has HMAC-SHA256 signature verification. |
| 21 | useTenant multi-tenant | FIXED | Fetches all memberships, `switchTenant()` with localStorage, TenantSelector component. |
| 22 | Kalkulacija/Nivelacija journal posting via RPC | FIXED | `post_kalkulacija` and `post_nivelacija` RPCs exist and are called from UI. |
| 23 | verify_jwt still false in config.toml | NOT FIXED | All 12 functions still have `verify_jwt = false`. Should be true for authenticated functions. |
| 24 | POS: posting before fiscalization | NOT FIXED | `PosTerminal.tsx` line 132-163: fiscalize-receipt is called, then process_pos_sale. Posting happens regardless of fiscalization result. |
| 25 | Invoice: "sent" = posted (SEF async issue) | NOT FIXED | `Invoices.tsx` line 83-98: status set to "sent" + journal posted immediately. No SEF state machine. |
| 26 | SEF requestId idempotency | NOT FIXED | `sef-submit` edge function has no `requestId` field for idempotent uploads. |
| 27 | SEF async polling/reconciliation | NOT FIXED | No background job or status polling. SEF sandbox simulates immediate acceptance. |
| 28 | Retail pricing: missing "ukalkulisani PDV" account | NOT FIXED | `post_kalkulacija` RPC posts D:1320/P:1329/P:1300 but does not separate embedded VAT from margin in 1329. |
| 29 | Payroll parameters table (effective-dated) | NOT FIXED | No `payroll_parameters` table. Rates, nontaxable, min/max bases all hardcoded in RPC. |
| 30 | eBolovanje integration | NOT FIXED | No implementation. Mandatory employer workflow from Jan 2026. |
| 31 | eOtpremnica compliance | PARTIAL | Page exists (`Eotpremnica.tsx`) but is a basic CRUD form. No XML/API submission to state system. No line items on the dispatch note. |
| 32 | Fiscalize-receipt: missing `body` parse | BUG | `fiscalize-receipt/index.ts` line 43: references `body` variable but never declares it (no `const body = await req.json()`). Function will crash at runtime. |
| 33 | Super admin audit trail | NOT FIXED | No logging of super admin cross-tenant actions. |
| 34 | RLS permissive policy warning | PRE-EXISTING | Linter shows 1 overly permissive RLS policy (USING true). |
| 35 | Leaked password protection disabled | PRE-EXISTING | Auth setting, not code-level. |

---

## CRITICAL FIXES REQUIRED (Implementation Plan)

### Fix 1: POS State Machine (Fiscalize Before Post)

**Current (broken):** PosTerminal.tsx calls fiscalize, ignores result, then posts accounting.

**Required state machine:**
```text
pos_transaction.status: draft -> pending_fiscal -> fiscalized -> posted
```

Changes:
- Insert transaction with status `pending_fiscal`
- Call `fiscalize-receipt`; if successful, update to `fiscalized`
- Only then call `process_pos_sale` RPC which sets `posted`
- If fiscalization fails but offline receipt generated (OFFLINE-prefix), still allow posting but flag it

**File:** `src/pages/tenant/PosTerminal.tsx` lines 110-166

### Fix 2: Invoice SEF State Machine

**Current (broken):** "Post" button sets status=sent and creates journal entry simultaneously, with SEF as an optional follow-up.

**Required (Model A -- strict):**
```text
invoice.status: draft -> pending_sef -> issued -> paid
```

Changes:
- "Post" button: sets status `pending_sef`, uploads to SEF with unique `requestId` (UUID)
- Background polling or manual "Check SEF Status" button
- Only when SEF confirms issuance: assign final number, post journal, deduct inventory
- If SEF rejects: status reverts to `draft` with error message

**OR Model B (pragmatic):**
- Keep current flow but add mandatory storno/credit note path if SEF permanently fails

Recommendation: **Model B** for now (simpler, matches current architecture), with SEF queue + reconciliation added later.

Changes for Model B:
- Add `sef_request_id` (UUID) column to invoices
- Generate unique requestId per SEF submission attempt
- Add "Retry SEF" button for failed submissions
- Add reconciliation check (compare local status vs SEF API status)

**Files:** `src/pages/tenant/Invoices.tsx`, `supabase/functions/sef-submit/index.ts`

### Fix 3: fiscalize-receipt Bug Fix

**Line 43** references `body` but it's never declared. The function will crash.

Add after line 33:
```typescript
const body = await req.json();
```

**File:** `supabase/functions/fiscalize-receipt/index.ts`

### Fix 4: Payroll Parameters Table

Create `payroll_parameters` table with effective-dated rates:

```text
payroll_parameters:
  - tenant_id uuid
  - effective_from date
  - effective_to date (nullable)
  - nontaxable_amount numeric (34,221 for 2026)
  - min_contribution_base numeric (51,297 for 2026)
  - max_contribution_base numeric (732,820 for 2026)
  - pio_employee_rate numeric (0.14)
  - health_employee_rate numeric (0.0515)
  - unemployment_employee_rate numeric (0.0075)
  - pio_employer_rate numeric (0.115)
  - health_employer_rate numeric (0.0515)
  - tax_rate numeric (0.10)
  - gazette_reference text (e.g., "Sl. glasnik RS 89/2020")
```

Update `calculate_payroll_for_run` to:
1. Look up parameters for the payroll period
2. Apply min/max base capping
3. Use stored rates instead of hardcoded constants

### Fix 5: Retail Pricing -- Embedded VAT Account

The standard Serbian retail method tracks embedded VAT separately from margin:

Current `post_kalkulacija` posts:
- D: 1320 (retail total)
- P: 1329 (all of markup + VAT)
- P: 1300 (cost)

Should be:
- D: 1320 (retail total incl. VAT)
- P: 1329 (margin only = retail excl VAT - cost)
- P: 1340 "Ukalkulisani PDV" (embedded VAT portion)
- P: 1300 (cost)

Need to:
1. Add account `1340` to seed function
2. Update `post_kalkulacija` RPC to split PDV from margin
3. Update `process_pos_sale` RPC to reverse embedded VAT at sale

### Fix 6: verify_jwt in config.toml

Change to `true` for all authenticated functions. Keep `false` only for:
- `web-order-import` (webhook)
- `web-sync` (webhook)
- `company-lookup` (public utility)
- `nbs-exchange-rates` (cron/public)
- `process-module-event` (internal)

```toml
[functions.create-tenant]
verify_jwt = true
[functions.ai-assistant]
verify_jwt = true
[functions.ai-insights]
verify_jwt = true
[functions.create-notification]
verify_jwt = true
[functions.generate-pdf]
verify_jwt = true
[functions.sef-submit]
verify_jwt = true
[functions.fiscalize-receipt]
verify_jwt = true
```

---

## IMPLEMENTATION ORDER

1. **Fix 3: fiscalize-receipt body bug** -- runtime crash, immediate fix
2. **Fix 6: verify_jwt config.toml** -- security hardening
3. **Fix 1: POS state machine** -- fiscal compliance
4. **Fix 2: Invoice SEF state machine (Model B)** -- SEF compliance
5. **Fix 4: Payroll parameters table** -- contribution base capping
6. **Fix 5: Retail embedded VAT account** -- retail accounting completeness

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | payroll_parameters table + seed, add account 1340, update post_kalkulacija RPC, add sef_request_id to invoices |
| `supabase/functions/fiscalize-receipt/index.ts` | Add missing `const body = await req.json()` |
| `supabase/config.toml` | Set verify_jwt=true for 7 functions |
| `src/pages/tenant/PosTerminal.tsx` | Implement fiscal-first state machine |
| `src/pages/tenant/Invoices.tsx` | Add SEF request_id, Model B state machine |
| `supabase/functions/sef-submit/index.ts` | Add requestId idempotency field |

### Out of Scope (Future Work)
- eBolovanje integration (requires RFZO API credentials)
- eOtpremnica state API submission (requires MoF API access, mandatory for private sector Oct 2027)
- Super admin audit trail (enhancement, not blocking)
- RLS permissive policy audit (pre-existing)

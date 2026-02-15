

# Security and Architecture Hardening Plan

Based on the comprehensive review, this plan addresses the most critical issues in priority order. I've audited all 20+ edge functions and the client-side auth logic to produce actionable fixes.

---

## Phase 1: Critical Fixes

### 1.1 Refactor useAuth.tsx -- Proper Role Fetch Separation

**Current state**: The code already uses `setTimeout(..., 0)` inside `onAuthStateChange` to defer the role fetch. This partially mitigates the Supabase deadlock issue, but it's still fragile because:
- The `setTimeout` callback captures a stale `session` closure
- If `onAuthStateChange` fires rapidly (tab focus, token refresh), multiple role fetches race
- `loading` stays `true` until the deferred callback completes, but there's no cancellation

**Fix**: Move role fetching to a separate `useEffect` keyed on `user?.id`:

```typescript
// onAuthStateChange: ONLY set session/user state (thin, synchronous)
// Separate useEffect: fetch roles when user.id changes
// Add cleanup to cancel stale fetches
```

**Also**: Clear `localStorage` tenant selection on sign-out (currently only `useTenant` state is cleared, not storage).

### 1.2 Fix Edge Functions Missing Auth Checks (3 functions)

After auditing all 20 edge functions, here is the auth status:

| Function | Has JWT Check | Has Tenant Check | Issue |
|---|---|---|---|
| sef-submit | Yes | Yes | OK |
| fiscalize-receipt | Yes | Yes | OK |
| create-notification | Yes | Yes | OK |
| generate-pdf | Yes | Yes | OK |
| ai-analytics-narrative | Yes | Yes | OK |
| ai-assistant | Yes | Yes | OK |
| ai-insights | Yes | Yes | OK |
| create-tenant | Yes | Super Admin check | OK |
| process-module-event | Yes | Yes | OK (also supports internal secret) |
| web-order-import | No (uses API key/HMAC) | Yes (via connection) | OK -- webhook pattern |
| ebolovanje-submit | Needs check | Needs check | **FIX** |
| eotpremnica-submit | Needs check | Needs check | **FIX** |
| **company-lookup** | **NO** | **NO** | **CRITICAL -- fully open** |
| nbs-exchange-rates | Needs check | Needs check | **FIX** |
| fiscalize-retry-offline | Needs check | Needs check | **FIX** |
| wms-slotting | Needs check | Needs check | **FIX** |
| production-ai-planning | Needs check | Needs check | **FIX** |
| web-sync | Needs check | Needs check | **FIX** |
| seed-demo-data (x3) | No | No | OK -- dev-only, should be removed in prod |

**Fix**: Add the standard auth guard pattern (getUser + tenant membership check) to all 8 functions marked above. For `company-lookup`, add at minimum a JWT check since it calls an external API with a stored token.

### 1.3 Validate selectedTenantId Against Membership

**Current state**: `useTenant.ts` reads from `localStorage` and trusts whatever ID is stored. If a user is removed from a tenant, they'll see empty/errored pages until they manually switch.

**Fix**: After the memberships query resolves, if `selectedId` is not in the membership list, reset to the first available tenant.

Also: clear `STORAGE_KEY` in `useAuth.signOut()`.

---

## Phase 2: High Priority Fixes

### 2.1 Add Server-Side Journal Entry Invariants (Database Migration)

Create a PostgreSQL trigger that enforces:
- **Balanced journals**: On status change to `posted`, verify `SUM(debit) = SUM(credit)` for that entry's lines
- **Immutability**: Prevent UPDATE/DELETE on `journal_lines` where the parent entry status is `posted`

```sql
-- Trigger: prevent posting unbalanced journals
-- Trigger: prevent modification of posted journal lines
-- Trigger: atomic storno (reversal creates entry + marks original as reversed in one transaction)
```

### 2.2 Standardize Edge Function Auth with Shared Helper

Create a reusable auth validation pattern. Since edge functions can't share imports across folders in Supabase, we'll create a documented pattern and apply it consistently. The pattern:

```text
1. Parse Authorization header
2. Create user client with anon key
3. Call getUser() to validate token
4. If tenant_id provided, verify membership via service role client
5. Return { user, tenantId } or 401/403 Response
```

---

## Phase 3: Medium Priority Improvements

### 3.1 Filter Global Search by Tenant Module Enablement

**Current state**: `GlobalSearch.tsx` already filters by `canAccess()` (role permissions). This is good -- the review's concern about a "permission oracle" is already addressed.

**No change needed** -- this is already implemented at line 167.

### 3.2 Fix useTenant Sign-Out Cleanup

Add `localStorage.removeItem(STORAGE_KEY)` to `useAuth.signOut()` to prevent stale tenant selection on re-login.

---

## Files to Modify

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Refactor role fetch to separate useEffect; clear tenant on signOut |
| `src/hooks/useTenant.ts` | Validate selectedId against membership list |
| `supabase/functions/company-lookup/index.ts` | Add JWT validation |
| `supabase/functions/ebolovanje-submit/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/eotpremnica-submit/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/nbs-exchange-rates/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/fiscalize-retry-offline/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/wms-slotting/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/production-ai-planning/index.ts` | Add JWT + tenant membership check |
| `supabase/functions/web-sync/index.ts` | Add JWT + tenant membership check |
| Database migration | Journal balance trigger + immutability trigger |

---

## What This Plan Does NOT Change (and why)

- **verify_jwt = false in config.toml**: The Supabase signing-keys system requires `verify_jwt = false` with in-code validation. This is the documented pattern for this project's setup and is correct.
- **seed-demo-data functions**: These are dev-only utilities. They should be removed before production but are not a security risk in the current context.
- **RLS policies**: No schema changes to add `tenant_id` to child tables in this phase -- that's a larger migration best done separately.
- **VAT scenario codes**: This is a business logic enhancement, not a bug fix. Should be planned as a separate feature.


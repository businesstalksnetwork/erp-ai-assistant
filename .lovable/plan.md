
# Security and Architecture Hardening Plan

Based on the comprehensive audit, here are the prioritized fixes grouped by severity.

---

## P0 -- Critical: Invoice Posting Atomicity

**Problem**: In `Invoices.tsx`, posting an invoice first updates status to "sent" (line 110-113), then calls `process_invoice_post` RPC (line 117-121). If the RPC fails, the invoice is stuck as "sent" without a journal entry -- an inconsistent state.

**Fix**: Reverse the order -- call the RPC first (which creates the journal entry), then update the status. If the RPC fails, the invoice stays "draft." Also fix the warehouse `"__none__"` value which passes a truthy non-UUID string to the RPC.

**File**: `src/pages/tenant/Invoices.tsx`

---

## P0 -- Critical: Non-Atomic Journal Entry Creation

**Problem**: `JournalEntries.tsx` creates the journal entry header, then inserts lines in a separate call. If line insertion fails, an orphan header remains. Same pattern exists in `stornoMutation`.

**Fix**: Create a new `create_journal_entry_with_lines` RPC that wraps header + lines in a single database transaction. Similarly, create a `storno_journal_entry` RPC. Update the UI to call these RPCs instead of making multiple client-side writes.

**Files**: New migration SQL, `src/pages/tenant/JournalEntries.tsx`

---

## P0 -- Critical: SECURITY DEFINER Functions Missing Auth Checks

**Problem**: Functions like `post_kalkulacija`, `post_nivelacija`, `calculate_payroll_for_run`, `process_pos_sale`, and `process_invoice_post` use SECURITY DEFINER but do NOT verify `auth.uid()` or check tenant membership. Since SECURITY DEFINER runs as the function owner (bypassing RLS), any authenticated user could potentially call these RPCs with arbitrary IDs.

**Fix**: Add `auth.uid()` membership verification at the start of each SECURITY DEFINER function. Example pattern:
```sql
IF NOT EXISTS (
  SELECT 1 FROM tenant_members
  WHERE user_id = auth.uid()
    AND tenant_id = v_tenant_id
    AND status = 'active'
) THEN
  RAISE EXCEPTION 'Access denied';
END IF;
```

**File**: New migration SQL

---

## P1 -- High: Auth Loading Spinner Lock

**Problem**: In `useAuth.tsx`, if the role fetch (`fetchRoles`) fails (network error, etc.), `setLoading(false)` is never called, leaving the app on an infinite loading spinner.

**Fix**: Add try/finally around the role fetch to ensure `loading` is always set to false.

**File**: `src/hooks/useAuth.tsx`

---

## P1 -- High: Permissions Flash-Allow on Module Load

**Problem**: `usePermissions.ts` returns `canAccess() = true` when `enabledModuleKeys` hasn't loaded yet (line 54). This means users briefly see pages for disabled modules before getting kicked out. Also, `settings-*` submodules are not in the ALWAYS_ON list, so settings sub-pages may be blocked for tenants that haven't explicitly enabled a "settings" module.

**Fix**: Make `canAccess()` pessimistic -- return `false` when modules haven't loaded (the loading spinner in `ProtectedRoute` already handles this). Treat all `settings` and `settings-*` as always-on.

**File**: `src/hooks/usePermissions.ts`

---

## P1 -- High: NBS Exchange Rate Function Issues

**Problem**: The `nbs-exchange-rates` function has two issues:
1. It ignores the date the user sends and always uses "last working day"
2. Its admin notification query filters `user_roles` by `tenant_id`, but `user_roles` has no `tenant_id` column -- it should query `tenant_members`

**Fix**: Honor the `date` parameter from the request body when provided. Fix the admin lookup to query `tenant_members` instead of `user_roles`.

**File**: `supabase/functions/nbs-exchange-rates/index.ts`

---

## P1 -- High: Mark-as-Paid Non-Atomic

**Problem**: `Invoices.tsx` mark-paid flow first updates status to "paid" then calls `create_journal_from_invoice` RPC. If RPC fails, invoice is "paid" without a payment journal entry.

**Fix**: Reverse order -- call the RPC first, then update status. Or better, have the RPC itself update the status within its transaction.

**File**: `src/pages/tenant/Invoices.tsx`

---

## Summary of Changes

| File | Change |
|---|---|
| `src/pages/tenant/Invoices.tsx` | Fix warehouse "__none__" bug; reverse post/mark-paid order to RPC-first |
| `src/pages/tenant/JournalEntries.tsx` | Replace 2-step client writes with atomic RPCs |
| `src/hooks/useAuth.tsx` | Add try/finally to role fetch |
| `src/hooks/usePermissions.ts` | Pessimistic canAccess; settings-* always-on |
| `supabase/functions/nbs-exchange-rates/index.ts` | Fix date handling; fix admin lookup table |
| New migration | Atomic journal entry RPC; storno RPC; auth checks in SECURITY DEFINER functions |

### Not In Scope (requires manual review)
- POPDV section mapping (compliance decision, not a code bug)
- SEF endpoint validation (requires access to latest SEF API docs)
- Full SECURITY DEFINER audit of all 34 migration files (will harden the most critical 5 functions)

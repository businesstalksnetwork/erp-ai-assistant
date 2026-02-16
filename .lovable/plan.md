

# Security Hardening: Phase 2

Addresses remaining gaps from the audit: SECURITY DEFINER functions without tenant checks, non-atomic client-side journal writes, and year-end closing accepting arbitrary user IDs.

---

## 1. Harden `check_fiscal_period_open` and `perform_year_end_closing`

**Problem**: Both are SECURITY DEFINER but lack `assert_tenant_member()` calls. `perform_year_end_closing` also accepts `p_user_id` as input instead of using `auth.uid()`, allowing impersonation.

**Fix** (SQL migration):
- Add `PERFORM public.assert_tenant_member(p_tenant_id)` to `check_fiscal_period_open`
- Add `PERFORM public.assert_tenant_member(p_tenant_id)` to `perform_year_end_closing`
- Replace `p_user_id` parameter with `auth.uid()` inside `perform_year_end_closing`
- Keep function signature accepting `p_user_id` for compatibility but ignore it internally, using `auth.uid()` instead

**File**: New SQL migration

---

## 2. Make `createCodeBasedJournalEntry` atomic

**Problem**: `src/lib/journalUtils.ts` inserts a journal entry header as "posted", then inserts lines in a separate call. If the second call fails, a posted entry with no lines exists -- violating accounting integrity. This utility is called from ~10 pages (BankStatements, Deferrals, GoodsReceipts, Returns, Payroll, FixedAssets, FxRevaluation, and more).

**Fix**: Refactor `createCodeBasedJournalEntry` to resolve account codes client-side, then call the existing `create_journal_entry_with_lines` RPC (created in the previous hardening migration) which handles everything atomically in a single transaction.

The function will:
1. Resolve account codes to IDs (read-only, safe to do client-side)
2. Call `create_journal_entry_with_lines` RPC with all data
3. The RPC handles balance check, fiscal period check, and atomic insert

**File**: `src/lib/journalUtils.ts`

No changes needed in the 10+ calling pages -- the function signature stays the same.

---

## 3. Update `YearEndClosing.tsx` to stop passing `user?.id`

**Problem**: The UI passes `user?.id` to `perform_year_end_closing`. After the SQL fix, the function will use `auth.uid()` internally, but we should clean up the client call.

**Fix**: The RPC signature still accepts `p_user_id` for backward compatibility, so no breaking change. But update the UI to pass `null` and add a comment that the server uses `auth.uid()`.

**File**: `src/pages/tenant/YearEndClosing.tsx`

---

## Summary

| File | Change |
|---|---|
| New SQL migration | Add `assert_tenant_member` to `check_fiscal_period_open` and `perform_year_end_closing`; use `auth.uid()` internally |
| `src/lib/journalUtils.ts` | Refactor to call atomic `create_journal_entry_with_lines` RPC instead of 2-step insert |
| `src/pages/tenant/YearEndClosing.tsx` | Minor: pass null for user_id (server uses auth.uid()) |


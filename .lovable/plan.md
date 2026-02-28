

## Phase 1: Security & Data Integrity — 7 Items

### Confirmed Findings

| # | Bug | Status |
|---|-----|--------|
| 1.1 | RLS policies on `service_contracts` + 5 loyalty tables use `tenant_members` directly instead of `get_user_tenant_ids()` (which filters `status='active'`) | Confirmed — 6 policies need update |
| 1.2 | Two triggers named `trg_check_journal_balance` — one on `journal_entries` (line 35, migration `20260215224033`), one on `journal_lines` (line 39, migration `20260228011858`) | Confirmed — collision on fresh install |
| 1.3 | No DELETE policy on `notifications` — `deleteNotification()` and `clearAllRead()` silently fail | Confirmed — `useNotifications.ts` lines 121-148 call `.delete()` |
| 1.4 | `sef-send-invoice` fetches invoice with `.eq('id', invoiceId)` only — no `.eq('company_id', companyId)` verification | Confirmed — line 249 |
| 1.5 | POS stock adjustments in client-side loop — `consume_fifo_layers` + `adjust_inventory_stock` called per item, partial failures create phantom stock | Confirmed — `PosTerminal.tsx` lines 471-497 |
| 1.6 | `redeem_loyalty_points` uses `SELECT * INTO` without `FOR UPDATE` — concurrent redemptions can overdraw balance | Confirmed — migration line 135 |
| 1.7 | `execute_readonly_query` has no row limit, 10s timeout (too generous), and no `LIMIT` enforcement | Confirmed — migration `20260223165215` |

### Implementation Plan

#### 1.1: Fix RLS policies to use `get_user_tenant_ids()`
- Migration: drop + recreate policies on `service_contracts`, `loyalty_programs`, `loyalty_members`, `loyalty_transactions`, `loyalty_rewards`, `loyalty_redemptions`
- Replace `USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()))` with `USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))`

#### 1.2: Fix trigger naming collision
- Migration: `DROP TRIGGER IF EXISTS trg_check_journal_balance ON journal_entries` (the old one)
- Rename to `trg_check_journal_entry_status` or just drop it since the `journal_lines` version is the active constraint trigger

#### 1.3: Add notifications DELETE policy
- Migration: `CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id)`

#### 1.4: Fix SEF invoice company verification
- In `sef-send-invoice/index.ts` line 249: add `.eq('tenant_id', company.tenant_id)` to the invoice fetch query to verify invoice belongs to the same tenant/company

#### 1.5: Create `complete_pos_transaction` RPC
- Migration: new function `complete_pos_transaction(p_tenant_id, p_session_id, p_items JSONB, p_payment_method, p_warehouse_id)` that atomically:
  - Inserts POS transaction
  - Loops items with `SELECT ... FOR UPDATE` on inventory
  - Calls `consume_fifo_layers` and `adjust_inventory_stock` inside the same transaction
  - Returns transaction data as JSONB
- Code: refactor `PosTerminal.tsx` `completeSale` to call the new RPC instead of the client-side loop

#### 1.6: Fix loyalty points race condition
- Migration: recreate `redeem_loyalty_points` with `SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id AND tenant_id = p_tenant_id FOR UPDATE`

#### 1.7: Harden `execute_readonly_query`
- Migration: recreate function with:
  - `statement_timeout` reduced to `5s`
  - Force `LIMIT 100` if no LIMIT clause present
  - Add `pg_catalog` to blocked schemas

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | Items 1.1–1.3, 1.5–1.7 (RLS, triggers, RPC, function hardening) |
| `supabase/functions/sef-send-invoice/index.ts` | Item 1.4 — add tenant/company verification to invoice fetch |
| `src/pages/tenant/PosTerminal.tsx` | Item 1.5 — replace client-side stock loop with `complete_pos_transaction` RPC call |

### Execution Order
1. Single migration covering items 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
2. `sef-send-invoice/index.ts` fix (item 1.4)
3. `PosTerminal.tsx` refactor to use new RPC (item 1.5)


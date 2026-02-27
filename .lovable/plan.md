

## Phase 1: Fix 7 Critical Bugs

After verification, **DB-CRIT-1** (RLS `USING(true)`) is already fixed — policies now use `get_user_tenant_ids()`. That leaves 7 bugs to fix.

### Bug 1: CR-CRIT-1 — Posting Engine passes UUID where account code expected

**File:** `src/lib/journalUtils.ts` — add `findAccountById()` function
**File:** `src/lib/postingRuleEngine.ts` line 201 — change `findAccountByCode` to `findAccountById`

```typescript
// journalUtils.ts — new function
export async function findAccountById(tenantId: string, accountId: string) {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("tenant_id", tenantId)
    .eq("id", accountId)
    .eq("is_active", true)
    .single();
  return data;
}
```

### Bug 2: CR-CRIT-2 — Hardcoded Supabase URLs (7 locations, 4 files)

Replace all `https://hfvoehsrsimvgyyxirwj.supabase.co` with `` `${import.meta.env.VITE_SUPABASE_URL}` `` in:
- `CreateTenantWizard.tsx` line 51
- `Payroll.tsx` lines 258, 274, 290
- `PayrollRunDetail.tsx` lines 135, 151
- `EmployeeDetail.tsx` line 327

### Bug 3: CR-CRIT-3 — POS unlimited re-refunds

**File:** `PosTerminal.tsx` `openRefundDialog` function (line 202)

Query prior refunds for `original_transaction_id`, sum already-refunded quantities per item name, subtract from `maxQuantity`. If no items remain, show toast and return.

### Bug 4: CR-CRIT-4 — POS double-counts VAT on retail prices

**File:** `PosTerminal.tsx` lines 197-199 (sale) and 229-231 (refund)

Change from adding tax on top to extracting tax from inclusive price:
```typescript
// Sale calculation (lines 197-199)
const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
const taxAmount = cart.reduce((s, c) => s + (c.unit_price * c.quantity * c.tax_rate) / (100 + c.tax_rate), 0);
const subtotal = total - taxAmount;

// Same fix for refund calculation (lines 229-231)
```

### Bug 5: INTER-CRIT-1 — Invoice posts even if inventory deduction fails

**File:** `InvoiceForm.tsx` line 546

Change `console.warn` to re-throw the error so the mutation fails and the user sees a toast. The invoice remains in its current status.

### Bug 6: INTER-CRIT-2 — Production module has zero inventory/GL integration

**Database:** Create `complete_production_order` RPC that:
1. Deducts BOM component stock via `adjust_inventory_stock`
2. Adds finished goods to stock
3. Updates production order status, actual_quantity, actual_end_date
4. Creates GL entry via posting rules engine (DR Finished Goods / CR WIP)

**File:** `ProductionOrderDetail.tsx` — call the new RPC instead of just updating status

### Bug 7: DB-CRIT-2 — journal_lines missing tenant_id

**Database migration:**
1. Add `tenant_id UUID REFERENCES tenants(id)` column
2. Backfill from `journal_entries`
3. Set NOT NULL
4. Add index `idx_journal_lines_tenant`
5. Update RLS policies to use direct column

### Execution Order
1. DB migration (Bug 7 — journal_lines tenant_id)
2. DB migration (Bug 6 — complete_production_order RPC)
3. Code fixes: Bugs 1, 2, 3, 4, 5, 6 (all client-side changes)

### Files Modified
| File | Bugs |
|------|------|
| `src/lib/journalUtils.ts` | 1 |
| `src/lib/postingRuleEngine.ts` | 1 |
| `src/components/super-admin/CreateTenantWizard.tsx` | 2 |
| `src/pages/tenant/Payroll.tsx` | 2 |
| `src/pages/tenant/PayrollRunDetail.tsx` | 2 |
| `src/pages/tenant/EmployeeDetail.tsx` | 2 |
| `src/pages/tenant/PosTerminal.tsx` | 3, 4 |
| `src/pages/tenant/InvoiceForm.tsx` | 5 |
| `src/pages/tenant/ProductionOrderDetail.tsx` | 6 |
| 2 database migrations | 6, 7 |


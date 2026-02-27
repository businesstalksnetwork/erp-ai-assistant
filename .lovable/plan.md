

## Phase 2: Fix 15 HIGH Bugs

Based on audit PRD verification against the codebase, here are the confirmed issues and fixes.

### Bug 1: CR-HIGH-1 — Credit note GL reversal ignores VAT

**File:** `src/pages/tenant/Returns.tsx` lines 322-325

The credit note fallback lines only reverse revenue (6000) and AR (2040) but ignore VAT. If the original invoice had VAT, the credit note must also reverse the output VAT line.

**Fix:** Add a third fallback line for output VAT reversal. Since credit notes currently lack line-item detail (no tax_rate stored), add a `tax_amount` field to the credit note form, and include a VAT reversal line when > 0:
```typescript
fallbackLines: [
  { accountCode: "6000", debit: f.amount - (f.tax_amount || 0), credit: 0, ... },
  { accountCode: "4700", debit: f.tax_amount || 0, credit: 0, ... },  // Reverse output VAT
  { accountCode: "2040", debit: 0, credit: f.amount, ... },
]
```

### Bug 2: CR-HIGH-2 — Credit note does not restore inventory

**File:** `src/pages/tenant/Returns.tsx` — credit note mutation (line 312-326)

When a credit note is issued, there's no inventory restoration. The return case resolution does restock, but issuing a standalone credit note from an invoice skips it.

**Fix:** After GL posting, if `f.invoice_id` exists, fetch invoice lines with product quantities, and call `adjust_inventory_stock` for each product item to restore stock.

### Bug 3: CR-HIGH-3 — Payroll posting missing legalEntityId

**Files:** `src/pages/tenant/Payroll.tsx` lines 189-210, `src/pages/tenant/PayrollRunDetail.tsx` lines 81-114

All 4 `postWithRuleOrFallback` calls in payroll omit `legalEntityId`. Multi-PIB tenants get journal entries that can't be filtered by legal entity.

**Fix:** Fetch `legal_entity_id` from the payroll run record and pass it to all `postWithRuleOrFallback` calls.

### Bug 4: CR-HIGH-4 — XML injection in SEF UBL generation

**File:** `supabase/functions/sef-send-invoice/index.ts` lines 140, 153, 160, 649, 662, 669

`client_pib`, `client_maticni_broj`, and `company.maticni_broj` are interpolated into XML without `escapeXml()`. A PIB containing `<` or `&` would produce malformed XML or enable injection.

**Fix:** Wrap all unescaped interpolations with `escapeXml()`:
- Line 140: `${escapeXml(invoice.client_pib)}`
- Line 153: `${escapeXml(...)}`
- Line 160: `${escapeXml(invoice.client_maticni_broj)}`
- Line 133: `${escapeXml(company.maticni_broj)}`
- Same for credit note XML (lines 649-669)

### Bug 5: CR-HIGH-5 — No ActionGuard on mutation buttons

`ActionGuard` component exists but is never used anywhere in the app. All create/edit/delete buttons are visible to all roles regardless of permissions.

**Fix:** Add `ActionGuard` wrapping to key mutation buttons across major pages:
- Invoices: create/delete buttons → `ActionGuard module="accounting" action="create/delete"`
- Sales orders/quotes: create buttons → `ActionGuard module="sales" action="create"`
- HR employees: create/edit → `ActionGuard module="hr" action="create/edit"`
- Inventory products: create → `ActionGuard module="inventory" action="create"`
- POS terminal: refund → `ActionGuard module="pos" action="delete"`
- Settings pages: add/edit buttons → appropriate guards

This is a broad change touching ~15 pages. Focus on the highest-risk actions first (delete, approve).

### Bug 6: CR-HIGH-6 — Payroll payment uses same model code as accrual

**File:** `src/pages/tenant/Payroll.tsx` line 223, `PayrollRunDetail.tsx` line 106

Payment posting uses `modelCode: "PAYROLL_NET"` — same as the accrual posting. If a tenant configures a posting rule for PAYROLL_NET, the same rule fires for both accrual and payment, which are different GL entries.

**Fix:** Change payment model code to `"PAYROLL_PAYMENT"` in both files.

### Bug 7: CR-HIGH-7 — Credit note form lacks tax_amount field

**File:** `src/pages/tenant/Returns.tsx`

The `CreditNoteForm` interface has no `tax_amount` field. Without it, Bug 1 can't be properly fixed — we need a way to specify how much VAT is being reversed.

**Fix:** Add `tax_amount: number` to `CreditNoteForm`, add an input field in the dialog, default to 0.

### Bug 8: CR-HIGH-8 — Return case restock uses first warehouse blindly

**File:** `src/pages/tenant/Returns.tsx` line 169

`const defaultWarehouse = warehouses[0]` — picks the first warehouse alphabetically, not the warehouse the items were shipped from. Could restock wrong location.

**Fix:** If the return case has a linked invoice/sales order, look up the dispatch warehouse. Fall back to first warehouse only if none found.

### Bug 9: CR-HIGH-9 — Payroll run detail doesn't save journal_entry_id

**File:** `src/pages/tenant/PayrollRunDetail.tsx` lines 81-119

The `postWithRuleOrFallback` calls return journal entry IDs but they're not saved back to `payroll_runs`. The main `Payroll.tsx` does save them, but `PayrollRunDetail.tsx` doesn't.

**Fix:** Capture return values from `postWithRuleOrFallback` and include `journal_entry_id`, `employer_journal_entry_id`, `payment_journal_entry_id` in the update.

### Bug 10: CR-HIGH-10 — escapeXml doesn't handle null/undefined safely for non-string inputs

**File:** `supabase/functions/sef-send-invoice/index.ts` line 206

`escapeXml` checks `if (!str)` which handles empty string but numeric 0 or boolean false would also return empty. Low risk for current usage but should be hardened.

**Fix:** Change to `if (str == null) return '';` then `return String(str).replace(...)`.

### Bugs 11-15: Additional HIGH items

**Bug 11:** `ai/briefing` route has no `ProtectedRoute` wrapper — any authenticated user can access regardless of role (line 188 in otherRoutes.tsx)

**Bug 12:** Profile route has no `ProtectedRoute` — accessible without authentication check at route level (relies on layout, but inconsistent)

**Bug 13:** Settings pages missing granular `requiredAction` — all settings routes use `requiredModule` with default "view" action, even for pages that perform writes

**Bug 14:** `PayrollRunDetail.tsx` duplicates the entire posting logic from `Payroll.tsx` — DRY violation creating divergence risk (refactor to shared function)

**Bug 15:** Credit note `open_items` update doesn't handle case where credit amount exceeds remaining — `Math.max(0)` prevents negative but doesn't warn user

### Execution Order
1. SEF XML injection fix (Bug 4) — deploy edge function
2. Payroll fixes (Bugs 3, 6, 9, 14) — code changes
3. Credit note GL + inventory (Bugs 1, 2, 7) — code changes
4. ActionGuard rollout (Bug 5) — broad UI changes
5. Route protection fixes (Bugs 11, 12) — quick route changes
6. Minor fixes (Bugs 8, 10, 13, 15)

### Files Modified
| File | Bugs |
|------|------|
| `supabase/functions/sef-send-invoice/index.ts` | 4, 10 |
| `src/pages/tenant/Returns.tsx` | 1, 2, 7, 8, 15 |
| `src/pages/tenant/Payroll.tsx` | 3, 6 |
| `src/pages/tenant/PayrollRunDetail.tsx` | 3, 6, 9, 14 |
| `src/routes/otherRoutes.tsx` | 11, 12 |
| ~15 pages for ActionGuard | 5 |


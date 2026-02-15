

# Implementation Plan

## Three Changes

### 1. Accounting Architecture Diagram Page

Create a new page at `/settings/accounting-architecture` that visually explains the accounting engine using styled cards and flow arrows (pure React/Tailwind, no external diagram library needed).

The page will show:
- **Source Documents** (Invoices, POS Receipts, Supplier Invoices, Payroll, Fixed Assets, Loans) flowing into the Journal Engine
- **Journal Engine** showing the double-entry posting flow (Draft -> Posted -> Reversed/Storno)
- **Posting Rules** connecting source modules to specific debit/credit account codes
- **Ledger & Reports** chain: Journal Lines -> General Ledger -> Trial Balance -> Income Statement / Balance Sheet
- **Tax & Compliance** branch: PDV/POPDV periods, Fiscal Periods, Year-End Closing
- **Sub-ledgers**: Fixed Assets (depreciation), Loans (amortization), Deferrals, FX Revaluation, Open Items, Kompenzacija

**Files:**
- Create `src/pages/tenant/AccountingArchitecture.tsx` -- the diagram page using cards with colored borders and connecting visual flow indicators
- Add route in `src/App.tsx` at `/settings/accounting-architecture`
- Add link in `src/pages/tenant/Settings.tsx` settings grid
- Add translation keys in `src/i18n/translations.ts`

### 2. Fix Super Admin Dashboard Counts

The dashboard queries use `select("id", { count: "exact", head: true })` which can return `null` for `count` in certain edge cases. The fix is to switch to a more reliable pattern using `.select("id").limit(0)` with `count: "exact"` or simply fetch rows and count them.

**Change in `src/pages/super-admin/Dashboard.tsx`:**
- Replace `head: true` count queries with regular selects that fetch actual rows
- Use `data.length` or the response `count` property with proper null handling
- Also add error logging so count failures are visible

### 3. Verify Sidebar Links Match Routes

After auditing all sidebar nav arrays in `TenantLayout.tsx` against the route definitions in `App.tsx`, **all links already match correctly**. The Journal Entries link was already fixed previously -- it points to `/accounting/journal` (line 90 of TenantLayout.tsx), which matches the route definition at line 199 of App.tsx.

No changes needed for sidebar links.

---

## Technical Details

### AccountingArchitecture.tsx Structure

The page will use a visual card-flow layout:

```text
+------------------+     +------------------+     +------------------+
| SOURCE DOCUMENTS |---->| POSTING RULES    |---->| JOURNAL ENGINE   |
| - Invoices       |     | - Module mapping |     | - Draft/Posted   |
| - POS Receipts   |     | - Debit/Credit   |     | - Storno logic   |
| - Supplier Inv.  |     | - Account codes  |     | - Balance check  |
| - Payroll        |     +------------------+     +------------------+
| - Fixed Assets   |                                       |
+------------------+                                       v
                                                  +------------------+
                          +------------------+    | GENERAL LEDGER   |
                          | SUB-LEDGERS      |<---| - Account totals |
                          | - Fixed Assets   |    +------------------+
                          | - Open Items     |             |
                          | - Deferrals      |             v
                          | - Loans          |    +------------------+
                          | - FX Reval.      |    | FINANCIAL REPORTS|
                          +------------------+    | - Trial Balance  |
                                                  | - Income Stmt    |
                          +------------------+    | - Balance Sheet  |
                          | TAX & COMPLIANCE |    +------------------+
                          | - PDV/POPDV      |
                          | - Fiscal Periods |
                          | - Year-End Close |
                          | - SEF e-Invoice  |
                          +------------------+
```

Each box is a clickable Card that navigates to the corresponding module page. Flow arrows use CSS borders/pseudo-elements.

### Super Admin Dashboard Fix

Replace the count pattern:

```typescript
// Before (unreliable)
supabase.from("tenants").select("id", { count: "exact", head: true })
// t.count || 0  -- count can be null

// After (reliable)  
supabase.from("tenants").select("id")
// t.data?.length || 0
```

This avoids the `head: true` + `count` edge case while still being efficient (only fetches `id` column).

### Files Modified

| File | Change |
|---|---|
| `src/pages/tenant/AccountingArchitecture.tsx` | New page -- visual architecture diagram |
| `src/App.tsx` | Add route for `/settings/accounting-architecture` |
| `src/pages/tenant/Settings.tsx` | Add architecture diagram card link |
| `src/i18n/translations.ts` | Add translation keys |
| `src/pages/super-admin/Dashboard.tsx` | Fix count queries to use reliable pattern |


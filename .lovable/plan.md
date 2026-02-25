

# Cross-Module Dependency Matrix: Audit Findings

## Summary

After comparing every `createCodeBasedJournalEntry` call, RPC invocation, and `adjust_inventory_stock` usage in the codebase against the documentation, I found **3 missing GL posting sources**, **1 incorrect dependency in the matrix**, and **several documentation gaps**.

---

## Finding 1: Three GL-Posting Files Missing from Documentation

The docs list 16 files that create journal entries. The actual codebase has **19**. These three are undocumented:

| File | GL Posting Method | What It Does |
|------|-------------------|--------------|
| `Loans.tsx` | `createCodeBasedJournalEntry` (hardcoded) | Creates journal entries for loan disbursements/repayments |
| `Returns.tsx` | `createCodeBasedJournalEntry` (hardcoded, up to 4 entries per return) | COGS reversal (DR 1200/CR 7000), credit note (DR 4000/CR 1200), supplier return (DR 4320/CR 1200), credit note issuance |
| `GoodsReceipts.tsx` | `createCodeBasedJournalEntry` (hardcoded) | Inventory receipt GL posting + calls `adjust_inventory_stock` |

All three use hardcoded account codes and should be added to:
- `docs/02-posting-rules-engine.md` → "Files That Create Journal Entries" table
- `docs/10-cross-module-dependency-matrix.md` → "GL Posting Flow — Complete Map"
- `docs/10-cross-module-dependency-matrix.md` → "Engine Migration Status" (all three are hardcoded, migration planned)

---

## Finding 2: Production → Accounting Dependency Is Wrong in Matrix

The dependency matrix (line 13) shows:

```
Production  ───    ·     ·     ·     →      ·      ·     ●     ·      ←
```

The `·` between Production and Accounting is **incorrect**. `ProductionOrders.tsx` calls `complete_production_order` RPC, which creates WIP (Work-in-Progress) journal entries server-side. The success handler shows `wipJournalCreated` toast message. This should be `→` (Production writes to Accounting).

Corrected row:
```
Production  ───    →     ·     ·     →      ·      ·     ●     ·      ←
```

---

## Finding 3: Kalkulacija and Nivelacija Use Server-Side RPCs, Not Client-Side Hardcoded

The GL Posting Flow map states both use "hardcoded → createCodeBasedJournalEntry". In reality:
- `Kalkulacija.tsx` calls `supabase.rpc("post_kalkulacija")` — server-side RPC
- `Nivelacija.tsx` calls `supabase.rpc("post_nivelacija")` — server-side RPC

Neither file imports or calls `createCodeBasedJournalEntry`. The documentation should reclassify them from "Hardcoded → createCodeBasedJournalEntry" to "RPC (server-side)" — same category as Invoices, POS, and Year-End.

---

## Finding 4: Returns.tsx Also Adjusts Inventory — Missing from Inventory Cross-Dependencies

`Returns.tsx` calls `adjust_inventory_stock` for restocking returned goods. This is not documented in `docs/05-inventory-module.md` under cross-module dependencies, nor is there a Returns entry in any dependency map.

---

## Finding 5: AdvancePayments Page Does Not Exist

The shared tables section in `docs/10-cross-module-dependency-matrix.md` lists "Advance Payments" as a user of the `partners` table. No `AdvancePayments.tsx` file exists in the codebase. The advance payment models (ADVANCE_RECEIVED, ADVANCE_PAID) exist only as posting rule payment models used within Bank Statements. This reference should be removed or clarified.

---

## Finding 6: GoodsReceipts.tsx Has Dual GL Touchpoint — Undocumented

`GoodsReceipts.tsx` both:
1. Calls `adjust_inventory_stock` RPC (documented in `05-inventory-module.md`)
2. Calls `createCodeBasedJournalEntry` with hardcoded accounts (undocumented)

The purchase lifecycle diagram in `10-cross-module-dependency-matrix.md` shows `adjust_inventory_stock` but omits the direct GL journal creation from goods receipt confirmation.

---

## Corrected Engine Migration Status Table

| Component | Engine | Status |
|-----------|--------|--------|
| Bank Statements | New (posting_rules) | Done |
| Kalkulacija | **RPC (server-side)** | N/A (server logic) |
| Nivelacija | **RPC (server-side)** | N/A (server logic) |
| Production Orders | **RPC (server-side)** | N/A (server logic) |
| Loans | **Hardcoded** | Planned |
| Returns | **Hardcoded** | Planned |
| Goods Receipts | **Hardcoded** | Planned |
| Payroll | Legacy (posting_rule_catalog) | Planned |
| Supplier Invoices | Hardcoded | Planned |
| Fixed Assets | Hardcoded | Planned |
| Cash Register | Hardcoded | Planned |
| FX Revaluation | Hardcoded | Planned |
| Deferrals | Hardcoded | Planned |
| Kompenzacija | Hardcoded | Planned |
| Intercompany | Hardcoded | Planned |

---

## Proposed Fix

Update three documentation files to correct all findings:
1. **`docs/02-posting-rules-engine.md`** — Add Loans, Returns, GoodsReceipts to "Files That Create Journal Entries"; reclassify Kalkulacija/Nivelacija as RPC
2. **`docs/10-cross-module-dependency-matrix.md`** — Fix Production→Accounting to `→`; add Loans/Returns/GoodsReceipts to GL Posting Flow; fix Kalkulacija/Nivelacija engine type; remove phantom AdvancePayments reference; add GoodsReceipts GL posting to purchase lifecycle
3. **`docs/05-inventory-module.md`** — Add Returns.tsx as an inventory stock adjuster in cross-module dependencies


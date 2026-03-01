

# Next Priority Items — Post-CR4 Fix Status

After completing all CR3-05 and CR4-01 through CR4-12 fixes, here are the remaining open items from the PRD, organized by priority.

---

## Still Open — CRITICAL (3 items)

### 1. P1-03: POS Triple Stock Deduction
**File:** `src/pages/tenant/PosTerminal.tsx` (lines 479-506)
Three independent stock deduction paths fire for a single POS sale (client-side `adjust_inventory_stock`, `process_pos_sale` RPC, `complete_pos_transaction` RPC). Each item sold reduces inventory by 3x. **Fix:** Remove client-side stock deduction call from PosTerminal.tsx.

### 2. P1-11: Credit Notes Dual Flow (POPDV/SEF gap)
**Files:** `CreditDebitNotes.tsx`, `InvoiceForm.tsx`, `popdvAggregation.ts`
Two disconnected credit note flows exist. Notes created via `CreditDebitNotes.tsx` go to `credit_notes` table and are never included in POPDV or submitted to SEF. **Fix:** Merge both flows so all credit notes use the `invoices` table with `invoiceType="credit_note"`.

### 3. P3-04: Advance Invoice Clearing Entry
**File:** `src/pages/tenant/InvoiceForm.tsx`
When `invoiceType === "advance_final"`, the advance clearing GL lines (DR 2270 / CR 2040) are missing. Advance amounts are never cleared from the balance sheet.

---

## Still Open — HIGH (6 items)

4. **P3-10: POPDV missing sections 1, 2, 4** — `popdvAggregation.ts` only handles basic output/input. Missing supplies without consideration, zero-rated exports, special procedures.

5. **P3-19: APR XML AOP mapping** — Uses simple account prefix grouping instead of proper 100+ AOP positions per official APR Obrazac 1.

6. **P3-22: Bank statement matching doesn't update invoice status** — Matched invoices remain "sent"/"overdue" in AR aging.

7. **P5-01: Year-end closing** — No implementation for closing classes 5→7, 6→7, and transferring net result to class 3.

8. **P5-02: Prior year opening balances** — No import/entry screen for beginning balances.

9. **P3-15: Debit note missing VAT line** — GL posting credits 6000 with no VAT separation.

---

## Still Open — MEDIUM/LOW (15+ items)

Phases 4-8 contain ~25 additional items including: invoice fiscal year number reset (P4-06), PP-PDV XML namespace (P4-08), loyalty module access (P4-11/P4-12), year-end features (P5-01 to P5-15), VAT special schemes (P6-06), and various polish items (P8-01 to P8-10).

---

## Recommended Next Batch

**Batch 5A — Fix 3 CRITICAL items:**
1. P1-03: Remove client-side stock deduction from PosTerminal.tsx (1 file)
2. P1-11: Unify credit note flow to use invoices table (3 files)
3. P3-04: Add advance clearing GL lines to InvoiceForm.tsx (1 file)

**Batch 5B — Fix 3 HIGH items:**
4. P3-22: Bank statement → invoice status update (1 file)
5. P3-15: Debit note VAT line (1 file)
6. P3-10: POPDV section completion (1 file)

| Batch | Items | Files Changed |
|-------|-------|---------------|
| **5A** | 3 CRITICAL | ~4 files |
| **5B** | 3 HIGH | ~3 files |


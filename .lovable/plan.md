
# V3.2 Audit Fixes — Status

## Round 4 (Completed)

### ✅ P3-04 — Advance Invoice Clearing GL Lines
Added DR 2270 / CR 2040 clearing entries when `invoiceType === "advance_final"` and advance amount applied > 0.

### ✅ P3-10 — POPDV Missing Credit Notes
`fetchOutputLines` now queries `credit_notes` table and includes them as negative amounts in POPDV VAT return aggregation.

### ✅ P3-12 — InvoiceForm FIFO Failure Must Reverse GL
On FIFO failure, the journal entry is now deleted before reverting invoice to draft, preventing split-brain state.

### ✅ P3-13 — 3-Way Match Missing Price Check
`performThreeWayMatch` now compares PO `unit_price` vs supplier invoice line price. Flags discrepancies > 1% tolerance.

### ✅ P3-07 — SEF Error HTTP Status Codes
`sef-cancel-sales-invoice` now returns HTTP 500 for errors instead of 200. (`sef-send-invoice` doesn't exist in codebase — skipped.)

### ✅ P4-07 — Fiscalization Tax Label Map
Corrected mapping: 10% → "B" (was "G"), 0% → "G" (was "E"). Now matches Pravilnik: A=20%, B=10%, G=0%.

### ✅ CR-27 — KpoBook Column Name
Verified — KpoBook uses correct column names. No fix needed.

## Previous Rounds (1-3) — All Completed
All items from Rounds 1-3 were addressed in previous sessions.

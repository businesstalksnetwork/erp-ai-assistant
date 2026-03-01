

# V3.3 PRD — All Items Complete ✅

All phases (1–7) are now implemented. Summary of final items completed:

---

## Phase 7A: SEF & Edge Function Polish ✅

1. **P4-09: SEF credit note root element** ✅ — Both `sef-submit` and `sef-send-invoice` now use `<CreditNote>` root with correct UBL namespace for document_type 381. Uses `CreditNoteLine` and `CreditedQuantity` tags.

2. **P3-05: SEF storno VAT categories** ✅ — `generateStornoUBLXml` now fetches actual `tax_rate_value` from `invoice_lines` table instead of using non-existent `item.tax_rate`. Passes `invLines` parameter for accurate VAT category determination.

3. **P3-07: SEF error HTTP codes** ✅ — Error handler now returns contextual status codes: 404 for not found, 403 for forbidden/missing config, 409 for duplicate SEF IDs, 502 for upstream SEF failures.

4. **P3-21: Invoice button label clarity** ✅ — Already correct: "Proknjizi" button sets status to "posted" (line 541).

## Phase 7B: Polish & Statutory ✅

5. **P5-04: Blagajnički dnevnik (Cash Journal)** ✅ — Enhanced CashRegister with sequential daily numbering (R.br.), running balance column, `sr-Latn-RS` date formatting, and `tabular-nums` for alignment.

6. **P8-05: T-account view** ✅ — Added T-account visualization to GeneralLedger page showing debit/credit totals with opening balance and net saldo.

7. **P8-06: Prior year comparison** ✅ — Already implemented via MultiPeriodReports year selectors.

8. **P8-08: Account class validation on posting** ✅ — JournalEntries now warns when class 6 (revenue) is posted to debit or class 5 (expense) to credit.

9. **P8-07: Serbian locale consistency** ✅ — GeneralLedger and CashRegister now use `toLocaleDateString("sr-Latn-RS")` and `toLocaleString("sr-RS")` with `minimumFractionDigits: 2`.

---

## Status: V3.3 COMPLETE

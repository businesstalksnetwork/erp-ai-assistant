

# V3.3 PRD — Remaining Items

After verifying all code, the major phases (1–4) and V3.3 features (Partner Statement, CIT advances, non-deductible calc) are complete. Here are the remaining open items organized by priority:

---

## Already Verified as Fixed (No Action Needed)
- P3-12: FIFO GL reversal ✅ (lines 556-566 in InvoiceForm.tsx — deletes GL on FIFO failure)
- P3-13: 3-way match price comparison ✅ (lines 174-190 in SupplierInvoices.tsx)
- P3-18: NBS unit division ✅ (nbs-exchange-rates divides by unit)
- P3-23: SEF BillingReference ✅ (sef-submit lines 191-200 support billing_reference_number)
- Travel per diem ✅ (line 131: `differenceInCalendarDays + 1`)

---

## Remaining Items — 2 Phases

### Phase 7A: SEF & Edge Function Polish (4 items)

1. **P4-09: SEF credit note root element** — `sef-submit/index.ts` uses `<Invoice>` root for document_type 381. Serbian eFaktura requires `<CreditNote>` root element with different namespace for type 381. Need a separate XML template or conditional root.

2. **P3-05: SEF storno VAT categories** — `sef-send-invoice` line 678 has comment "Fix storno" but need to verify it actually uses original invoice VAT rates instead of hardcoding SS/0%.

3. **P3-07: SEF error HTTP codes** — Partially fixed (line 667 returns proper status). Verify all error paths return appropriate 4xx/5xx.

4. **P3-21: Invoice button label clarity** — The "Proknjizi" button on InvoiceForm posts to GL directly (confirmed line 541 sets status to "posted"). The PRD claimed it only sets "sent" — this appears already fixed. Verify UI label matches behavior.

### Phase 7B: Polish & Statutory (5 items)

5. **P5-04: Blagajnički dnevnik (Cash Journal)** — No dedicated RSD cash journal page exists (only FX cash register). Need a new page with sequential daily numbering, running balance, and print/export.

6. **P8-05: T-account view** — No T-account visualization exists. Add a simple T-account rendering for any GL account showing debits left, credits right.

7. **P8-06: Prior year comparison** — Multi-period reports don't show prior year columns. Add a "vs Prior Year" toggle.

8. **P8-08: Account class validation on posting** — Warn when posting revenue (class 6) to debit or expense (class 5) to credit in JournalEntries.

9. **P8-07: Serbian locale consistency** — Audit remaining date formatters across older pages to ensure `sr-Latn-RS` locale usage.

---

## Technical Summary

| Phase | Items | Scope |
|-------|-------|-------|
| **7A** | 4 | Edge function edits (sef-submit, sef-send-invoice) |
| **7B** | 5 | 1 new page (Cash Journal) + 4 minor UI enhancements |

**Recommendation:** Start with Phase 7A (SEF compliance — critical for eFaktura submission), then 7B (polish).


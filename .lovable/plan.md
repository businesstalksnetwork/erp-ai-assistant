

# Round 5: Next V3.2 Audit Fixes

## What's already been fixed (Rounds 1-4)
P1-03, P1-04, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P2-01–P2-10, P3-02–P3-15, P3-18, P3-20, P3-22, P3-24, P4-07, P4-08, CR-01 through CR-36, CR2-01 through CR2-14, plus AI reliability fixes.

## Next unfixed items by priority

### Fix 1: P3-21 — Invoice Button Labels Misleading (HIGH)
**File:** `src/pages/tenant/InvoiceForm.tsx` lines 1057-1074
**Issue:** Two identical buttons both call `saveMutation.mutate("sent")` — neither posts GL nor sends to SEF. The actual GL posting is a separate green button (line 1078-1085). Having two identical buttons with different labels ("Post to GL" and "Post and Send SEF") that do the same thing (just save as "sent") is confusing.
**Fix:** Remove the duplicate button. Rename the remaining one to "Pošalji / Save as Sent". Keep the green "Proknjiži" button as the actual GL posting action.

### Fix 2: P3-23 — Credit Note Missing SEF BillingReference (HIGH)
**File:** `src/pages/tenant/InvoiceForm.tsx`
**Issue:** When `invoiceType === "credit_note"`, the code doesn't pass the original invoice's `sef_invoice_id` as `billing_reference_number` to `sef-submit`. SEF will reject credit notes without a BillingReference to the original invoice.
**Fix:** Add a field or lookup for the original invoice's SEF ID, and pass it when saving/posting a credit note.

### Fix 3: P4-09 — SEF Credit Note Document Type (MEDIUM)
**File:** `supabase/functions/sef-submit/index.ts`
**Issue:** Credit notes (type 381) should use `CreditNote` root element, not `Invoice`. Verify current implementation handles this.
**Fix:** Check and add CreditNote document type support if missing.

### Fix 4: P3-16 — PB-1 Tax Depreciation Auto-Population (HIGH)
**File:** `src/pages/tenant/PoreskiBilans.tsx`
**Issue:** PB-1 line 28 (ZPDP amortizacija) is always 0 — no integration with `fixed_asset_depreciation_schedules`.
**Fix:** Auto-populate line 28 from `SUM(tax_depreciation_amount)` for the tax year.

### Fix 5: P4-15 — Leave Days Working Days Not Calendar (MEDIUM)
**File:** `src/pages/tenant/LeaveRequests.tsx`
**Issue:** Leave day count uses calendar days. Per ZoR Art. 75, annual leave is in working days (exclude weekends + holidays).
**Fix:** Calculate working days by excluding Saturdays, Sundays, and entries from `holidays` table.

### Fix 6: P4-16 — Travel Order Per Diem Off by One (MEDIUM)
**File:** `src/pages/tenant/TravelOrderForm.tsx`
**Issue:** Same-day trip counts as 0 dnevnica instead of 1.
**Fix:** Add +1 to the day calculation.

## Summary
- **1 frontend file major** (InvoiceForm.tsx — button cleanup + credit note BillingReference)
- **1 edge function** (sef-submit — credit note document type check)
- **3 frontend files minor** (PoreskiBilans.tsx, LeaveRequests.tsx, TravelOrderForm.tsx)
- Fixes 3 HIGH + 3 MEDIUM issues


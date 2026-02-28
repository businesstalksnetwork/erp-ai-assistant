


# Round 5: V3.2 Audit Fixes — COMPLETED

## What's already been fixed (Rounds 1-5)
P1-03, P1-04, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P2-01–P2-10, P3-02–P3-16, P3-18, P3-20–P3-24, P4-07–P4-09, P4-15, P4-16, CR-01 through CR-36, CR2-01 through CR2-14, plus AI reliability fixes.

## Round 5 fixes applied
- **P3-21**: Removed duplicate "Post to GL" / "Post and Send SEF" buttons, replaced with single "Pošalji" button
- **P3-23**: Credit notes now pass `document_type: 381` and `billing_reference_number` (original invoice SEF ID) to sef-submit
- **P4-09**: Verified sef-submit already supports document_type 381 and BillingReference in UBL XML
- **P3-16**: PB-1 line 28 now auto-populates from `fixed_asset_depreciation_schedules` tax_depreciation_amount
- **P4-15**: Leave day count now uses working days (excludes weekends + holidays table)
- **P4-16**: Travel order per diem fixed: same-day trip now counts as 1 day (+1 to differenceInCalendarDays)

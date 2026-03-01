

# V3.3 — All Items Complete ✅

All remaining V3.3 items have been implemented:

- ✅ **Kartica partnera** — `src/pages/tenant/PartnerStatement.tsx` with partner selector, date range, running balance, CSV export. Route: `/accounting/partner-statement`
- ✅ **CIT Advance Payments** — `src/components/cit/CitAdvancePayments.tsx` with quarterly schedule, paid checkbox, overdue badges. Uses existing `cit_advance_payments` table.
- ✅ **Non-Deductible Auto-Calc** — `src/components/cit/NonDeductibleCalc.tsx` auto-calculates 552 (0.5%) and 553 (10%) limits, feeds into CIT adjustments.
- ✅ **Serbian locale dates** — All new components use `sr-Latn-RS` for date formatting.



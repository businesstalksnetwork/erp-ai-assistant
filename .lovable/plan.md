

## v2.3 Round 1 — P1 Quick Wins (4 items) ✅ COMPLETED

### Completed Items

**#9 — Cron schedule for recurring engines ✅**
- Added `recurring-invoice-generate` and `recurring-journal-generate` to `config.toml`
- Created pg_cron jobs: daily at 06:00 UTC (invoices) and 06:05 UTC (journals)
- Both call edge function URLs with anon key auth

**#10 — Recurring invoice line items ✅**
- Updated `recurring-invoice-generate/index.ts` to parse `tpl.lines` JSON array
- Inserts each line into `invoice_lines` with calculated totals
- Updated `RecurringInvoices.tsx` with full line items editor (description, qty, price, VAT rate)
- Template dialog now shows running subtotal/tax/total

**#1 — OD-O Form ✅**
- Created `od_o_reports` table with RLS
- Created `src/pages/tenant/reports/OdOForm.tsx` with:
  - Employee selector, period picker, income type dropdown
  - Real-time calculation preview with Serbian OD-O rates (normirani troškovi, PIO, zdravstveno)
  - Generate/download XML button
- Created `generate-od-o-xml` edge function
- Added route `/accounting/reports/od-o` and sidebar entry

**#2 — M4 Annual PIO Report ✅**
- Created `m4_reports` table with RLS
- Created `src/pages/tenant/reports/M4Report.tsx` with:
  - Year selector, generate button
  - Per-employee breakdown: months worked, PIO base, PIO employee, PIO employer
  - Summary totals row
  - Download XML button
- Created `generate-m4-xml` edge function (aggregates from payroll_items)
- Added route `/accounting/reports/m4` and sidebar entry

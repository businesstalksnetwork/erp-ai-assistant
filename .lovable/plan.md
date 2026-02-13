

# PDF Reports for Serbian Regulatory Compliance

## Overview

Extend the existing `generate-pdf` edge function to produce downloadable PDF-quality HTML reports for all major financial statements and the PDV (VAT) return. Each report page will get a "Download PDF" button alongside the existing Print and CSV Export buttons.

---

## Current State

- **Invoice PDF**: Already implemented in `generate-pdf` edge function (Serbian FAKTURA format)
- **Payslip (Platna Lista)**: Already implemented in `generate-pdf` (employee payslip with contributions breakdown)
- **Financial reports**: Trial Balance, Income Statement, Balance Sheet exist as interactive pages with `PrintButton` (window.print) and CSV export -- but no styled PDF download
- **PDV Periods**: Full POPDV section calculation exists but no exportable PDF for tax authority submission

---

## Reports to Add

### 1. Trial Balance PDF (Bruto Bilans)
- Company header with legal entity info (name, PIB, maticni broj)
- Date range header
- Table: Account Code | Account Name | Debit | Credit | Balance
- Footer totals row
- Serbian formatting (sr-RS locale for numbers)

### 2. Income Statement PDF (Bilans Uspeha)
- Revenue section grouped by account
- Expense section grouped by account
- Subtotals for each section
- Net profit/loss line
- Period header with date range

### 3. Balance Sheet PDF (Bilans Stanja)
- Assets section with subtotal
- Liabilities section with subtotal
- Equity section with subtotal
- Assets = Liabilities + Equity verification line
- As-of date header

### 4. PDV Return PDF (PDV Prijava / POPDV Obrazac)
- POPDV sections (3, 3a, 4, 5, 6, 8a, 8b, 8v, 9, 10, 11) with base amounts and VAT
- Output VAT total vs Input VAT total
- Net VAT payable/refundable
- Period and legal entity header
- Format matching Serbian tax authority expectations

### 5. Aging Report PDF (Starost Potraživanja)
- Grouped by partner
- Columns: Current | 1-30 days | 31-60 days | 61-90 days | 90+ days
- Totals row

---

## Technical Approach

### Edge Function: `supabase/functions/generate-pdf/index.ts`

Extend the existing function with new `type` values:
- `type: "trial_balance"` with `tenant_id`, `date_from`, `date_to`
- `type: "income_statement"` with `tenant_id`, `date_from`, `date_to`
- `type: "balance_sheet"` with `tenant_id`, `as_of_date`
- `type: "pdv_return"` with `pdv_period_id`
- `type: "aging_report"` with `tenant_id`, `as_of_date`

Each generates a styled HTML document with:
- Consistent company header (legal entity name, PIB, address)
- Serbian number formatting (sr-RS locale)
- Print-optimized CSS (@media print styles, page breaks)
- Professional styling matching the existing invoice/payslip template

### Frontend: Download PDF Button Component

Create a reusable `DownloadPdfButton` component that:
- Calls the `generate-pdf` edge function with the appropriate parameters
- Opens the returned HTML in a new tab (users can then print to PDF or save)
- Shows loading state during fetch

### Pages to Update

Each report page gets a `DownloadPdfButton` next to the existing Print/Export buttons:

- `TrialBalance.tsx` -- adds Download PDF with date range params
- `IncomeStatement.tsx` -- adds Download PDF with date range params
- `BalanceSheet.tsx` -- adds Download PDF with as-of-date param
- `PdvPeriods.tsx` -- adds Download PDF per period (in the detail/view area)
- `AgingReports.tsx` -- adds Download PDF with as-of-date param
- `Payroll.tsx` -- ensure existing payslip download works for each employee row

### Bug Fix in `generate-pdf`

The existing code has a bug on line 51: it references `admin` before it's declared (line 61). The `const admin = createClient(...)` line needs to move above the payslip branch.

---

## Files Changed

### Modified
- `supabase/functions/generate-pdf/index.ts` -- add 5 new report types + fix admin declaration order
- `src/pages/tenant/TrialBalance.tsx` -- add Download PDF button
- `src/pages/tenant/IncomeStatement.tsx` -- add Download PDF button
- `src/pages/tenant/BalanceSheet.tsx` -- add Download PDF button
- `src/pages/tenant/PdvPeriods.tsx` -- add Download PDF button per period
- `src/pages/tenant/AgingReports.tsx` -- add Download PDF button
- `src/i18n/translations.ts` -- new keys: downloadPdf, generatingPdf, pdfReady

### New
- `src/components/DownloadPdfButton.tsx` -- reusable button component

---

## Implementation Order

1. Fix the `admin` variable bug in `generate-pdf`
2. Add `DownloadPdfButton` component
3. Add Trial Balance PDF generation + button
4. Add Income Statement PDF generation + button
5. Add Balance Sheet PDF generation + button
6. Add PDV Return PDF generation + button
7. Add Aging Report PDF generation + button
8. Add translation keys
9. Deploy edge function


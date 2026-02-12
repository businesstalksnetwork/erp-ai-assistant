

# Phase 13: Data Export, PDF Generation and Reporting Enhancements

Elevate the ERP from a data-entry system to a business tool that produces professional outputs -- PDF invoices, CSV/Excel exports, and printable financial reports. This is a high-impact phase that directly enables day-to-day business operations.

---

## What Gets Built

### 1. PDF Invoice Generation
Generate professional PDF invoices (compliant with Serbian business standards) that can be downloaded or emailed to partners. Includes company logo, legal entity info, line items, tax breakdown, and bank details.

### 2. CSV/Excel Export for All List Pages
Add a universal "Export" button to all major list views (Invoices, Partners, Products, Journal Entries, Employees, Inventory Stock, etc.) that downloads filtered data as CSV.

### 3. Enhanced Financial Reports
Make Trial Balance, Income Statement, and Balance Sheet pages exportable as CSV and printable with a clean print stylesheet.

### 4. Dashboard PDF Summary
Allow exporting the main dashboard KPIs and charts as a one-page PDF summary for management reporting.

---

## Edge Function: `generate-pdf`

A new edge function that accepts structured data and returns a PDF blob:
- Uses a lightweight HTML-to-PDF approach (server-side HTML template rendered to PDF)
- Supports invoice templates with Serbian locale formatting (dd.MM.yyyy dates, RSD currency, PIB/maticni broj)
- Returns the PDF as a downloadable binary response

---

## Frontend Changes

### New Components

| Component | Description |
|-----------|-------------|
| `ExportButton.tsx` | Reusable button component that accepts data array + column definitions and triggers CSV download |
| `PrintButton.tsx` | Triggers `window.print()` with a print-optimized stylesheet applied |

### Modified Pages

| Page | Changes |
|------|---------|
| `Invoices.tsx` | Add "Download PDF" action per invoice row; add "Export CSV" button to header |
| `Partners.tsx` | Add "Export CSV" button |
| `Products.tsx` | Add "Export CSV" button |
| `JournalEntries.tsx` | Add "Export CSV" button |
| `Employees.tsx` | Add "Export CSV" button |
| `InventoryStock.tsx` | Add "Export CSV" button |
| `TrialBalance.tsx` | Add "Export CSV" and "Print" buttons |
| `IncomeStatement.tsx` | Add "Export CSV" and "Print" buttons |
| `BalanceSheet.tsx` | Add "Export CSV" and "Print" buttons |
| `Dashboard.tsx` | Add "Export Summary" button |

---

## Technical Details

### CSV Export Utility (`src/lib/exportCsv.ts`)

A utility function that:
- Accepts an array of objects and column definitions (key, label, formatter)
- Generates a CSV string with proper escaping (handles commas, quotes, newlines)
- Triggers browser download with a timestamped filename
- Supports Serbian characters (UTF-8 BOM prefix for Excel compatibility)

### PDF Invoice Template

The edge function builds an HTML string with:
- Company header (from `legal_entities` table -- name, PIB, maticni broj, address)
- Invoice metadata (number, date, due date, partner info)
- Line items table (description, quantity, unit price, tax, total)
- Tax summary breakdown by rate
- Payment details (bank account from `bank_accounts` table)
- Footer with legal text

The HTML is converted to PDF using Deno's built-in capabilities or a lightweight library.

### Print Stylesheet (`src/index.css` additions)

```text
@media print {
  - Hide sidebar, header, buttons, and navigation
  - Set white background, black text
  - Optimize table layouts for paper
  - Force page breaks between sections
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/exportCsv.ts` | CSV generation and download utility |
| `src/components/ExportButton.tsx` | Reusable CSV export button |
| `src/components/PrintButton.tsx` | Reusable print button |
| `supabase/functions/generate-pdf/index.ts` | PDF generation edge function |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Invoices.tsx` | Add PDF download and CSV export |
| `src/pages/tenant/Partners.tsx` | Add CSV export |
| `src/pages/tenant/Products.tsx` | Add CSV export |
| `src/pages/tenant/JournalEntries.tsx` | Add CSV export |
| `src/pages/tenant/Employees.tsx` | Add CSV export |
| `src/pages/tenant/InventoryStock.tsx` | Add CSV export |
| `src/pages/tenant/TrialBalance.tsx` | Add CSV export + print |
| `src/pages/tenant/IncomeStatement.tsx` | Add CSV export + print |
| `src/pages/tenant/BalanceSheet.tsx` | Add CSV export + print |
| `src/pages/tenant/Dashboard.tsx` | Add summary export |
| `src/index.css` | Add print media query styles |
| `src/i18n/translations.ts` | Add EN/SR keys for export, download, print actions |
| `supabase/config.toml` | Register generate-pdf function |

---

## i18n Keys

- Actions: exportCsv, downloadPdf, printReport, exportSummary
- Labels: exportSuccess, generatingPdf, noDataToExport
- Invoice PDF: invoicePdfTitle, taxSummary, paymentDetails, bankAccount, totalDue

---

## Security Notes

- The `generate-pdf` edge function requires authentication (reads tenant data server-side using the user's JWT)
- CSV export happens entirely client-side -- no additional API calls needed beyond the already-fetched data
- PDF generation fetches invoice + legal entity + bank account data using the service role key, scoped to the user's tenant


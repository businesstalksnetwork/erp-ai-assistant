

# Payroll PDF Export and AI Anomaly Warnings

## Feature 1: Individual Payslip PDF Download

The backend `generate-pdf` edge function already has a `payslip` type handler that generates a full "Platna Lista" PDF for individual employees. We just need to add a download button per employee row in the payroll items table.

### Changes

**`src/pages/tenant/Payroll.tsx`**
- Import `DownloadPdfButton` component
- Add a new column "Akcije" (Actions) to the payroll items table header
- In each employee row, add a `DownloadPdfButton` with `type="payslip"` and `params={{ payroll_item_id: item.id }}`
- Only show the button for runs with status "calculated", "approved", or "paid"

## Feature 2: AI Anomaly Detection on Payroll Page

The `ai-insights` edge function already detects excessive overtime (>40h/month), leave balance warnings, and payroll cost anomalies. We just need to display the existing `AiModuleInsights` component on the Payroll page.

### Changes

**`src/pages/tenant/Payroll.tsx`**
- Import `AiModuleInsights` from `@/components/shared/AiModuleInsights`
- Add `{tenantId && <AiModuleInsights tenantId={tenantId} module="hr" />}` between the parameters card and the accordion list
- This will automatically show warnings for excessive overtime, missing work log anomalies, low leave balances, and payroll cost spikes

### Translation Keys

**`src/i18n/translations.ts`**
- Add `actions` key for the new table column header (en: "Actions", sr: "Akcije")

## Technical Summary

Both features leverage existing infrastructure -- the payslip PDF generator and the AI insights engine are already built. This is purely a UI wiring task with no backend changes needed.


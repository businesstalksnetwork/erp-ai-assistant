

# Fix Remaining POPDV Issues

## Issues to Fix

1. **PopdvFieldSelect filters out special records** — Line 59 has `.filter((t: any) => !t.is_special_record)` which hides section headers and special sub-entries (1.4.q, 8a.2.a, etc.). Should show all entries but style special ones differently.

2. **Foreign entity detection → auto-suggest 8g.1 on SupplierInvoiceForm** — When supplier's PIB is non-Serbian format (not 9 digits) or country is foreign, auto-set POPDV to `8g.1`.

3. **Warning when vat_date falls in locked PDV period** — Query `pdv_periods` for the period covering `vatDate`; if `is_locked`, show a warning banner on both InvoiceForm and SupplierInvoiceForm.

4. **POPDV period indicator on invoices** — Show which PDV month the `vatDate` falls into (e.g., "PDV period: januar 2026") next to the vat_date field.

5. **Cost center per supplier invoice line** — Add `cost_center_id` column selector to the SupplierInvoiceForm line items table (column exists in DB, not in UI).

6. **PostingPreviewPanel on SupplierInvoiceForm** — Already imported but not rendered. Add it before the Actions section.

7. **"Proknjizi" (Post) button on InvoiceForm** — Add a button that creates actual GL journal entries via `postWithRuleOrFallback`, similar to how SupplierInvoices.tsx does approval posting.

## Implementation Steps

### A. Fix PopdvFieldSelect.tsx
- Remove the `.filter((t: any) => !t.is_special_record)` on line 59
- Keep italic styling for special records but show them as selectable options
- Add indentation (padding-left) for entries with `parent_id` to show hierarchy

### B. SupplierInvoiceForm.tsx — Foreign entity detection + cost center + posting preview
- Fetch selected supplier's country/PIB from `suppliers` list
- When supplier changes: if PIB is not 9 digits or country is not "RS"/"Srbija", auto-set new lines' POPDV to `8g.1`
- Add `cost_center_id` select column (fetch `cost_centers` table)
- Render `PostingPreviewPanel` with `buildSupplierInvoicePreviewLines` before Actions section

### C. Locked period warning (shared hook)
- Create `usePdvPeriodCheck(tenantId, vatDate)` hook that queries `pdv_periods` to find if the period is locked
- Returns `{ isLocked, periodName }` 
- Show yellow warning Alert on both forms when period is locked
- Show period name indicator (e.g., "PDV: januar 2026") next to vat_date

### D. InvoiceForm.tsx — "Proknjizi" button
- Import `postWithRuleOrFallback` and add a `postMutation`
- Button appears when status is "sent" (invoice sent but not yet posted to GL)
- Creates GL entry: DR 2040 Kupci, CR 6xxx Prihodi, CR 4700 PDV
- Updates invoice status to "posted" after successful GL entry
- Uses `GlPostingPreview` component already rendered for preview

### E. Both forms — PDV period display
- Compute period month/year from `vatDate`, display as "PDV period: Mesec YYYY" label near vat_date field

## Files to Modify
- `src/components/accounting/PopdvFieldSelect.tsx` — remove special record filter, add indent
- `src/hooks/usePdvPeriodCheck.ts` — new hook
- `src/pages/tenant/InvoiceForm.tsx` — add locked warning, period label, post button
- `src/pages/tenant/SupplierInvoiceForm.tsx` — add foreign entity detection, cost center, posting preview, locked warning, period label


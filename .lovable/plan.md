

## Phase 5: Accounting/Legal Hardening

### Bug 1: CIT Tax Return ignores classes 7, 8, 9

**File:** `src/pages/tenant/CitTaxReturn.tsx` lines 63-76

The CIT calculation only sums class 6 (revenue) and class 5 (expenses). The Serbian CoA has:
- Class 7: Opening/closing balance entries (revenue + equity + expense types)
- Class 8: Equity adjustments, off-balance items
- Class 9: Cost accounting (expense type)

The P&L calculation misses class 7 revenue/expense and class 9 expenses entirely.

**Fix:** Expand the calculation to use `account_type` instead of code prefix:
- Revenue: `account_type === 'revenue'` (covers classes 6 and 7)
- Expenses: `account_type === 'expense'` (covers classes 5, 7, 9)

Also: add `tax_adjustments_increase` and `tax_adjustments_decrease` input fields (columns already exist in DB but UI doesn't expose them), and compute `taxable_base = accounting_profit + adjustments_increase - adjustments_decrease`.

### Bug 2: CIT Tax Return missing tax credits

**File:** `src/pages/tenant/CitTaxReturn.tsx` lines 78-90

The `tax_credits` column exists in DB but is never populated. The final tax should be `tax_amount - tax_credits`.

**Fix:** Add a `tax_credits` input field and use it in the calculation: `final_tax = Math.max(0, tax_amount - tax_credits)`.

### Bug 3: BilansStanja only maps classes 0-4

**File:** `src/pages/tenant/BilansStanja.tsx` lines 23-29, 171-173

`ACCOUNT_CLASSES` only defines classes 0-4. Classes 5-9 exist in the CoA. The balance sheet correctly only shows 0-4 but the constants are incomplete for reference.

More importantly, the assets/liabilities/equity grouping (lines 171-173) maps class 2 to liabilities and class 3 to liabilities, but class 3 is primarily equity in Serbian CoA, and class 4 contains both long-term liabilities and deferred revenue.

**Fix:** 
- Update `ACCOUNT_CLASSES` to include all 10 classes (0-9) for completeness
- Fix the grouping: assets = classes 0, 1; equity = class 3; liabilities = classes 2, 4
- The current code puts class 3 in `liabilities` and class 4 in `equity` — swap these

### Bug 4: Invoice numbering ignores BusinessRules prefix/sequence

**File:** `src/pages/tenant/InvoiceForm.tsx` lines 194-207

Invoice number generation counts existing invoices for the year and generates `INV-{year}-{seq}`. It ignores the `invoice_prefix` and `invoice_next_seq` from `tenant_settings`. The BusinessRules page lets users configure these but they're never consumed.

**Fix:** Fetch `tenant_settings` and use `invoice_prefix` for the prefix. For the sequence, use `Math.max(invoice_next_seq, existingCount + 1)` to respect the configured starting sequence while preventing duplicates.

### Bug 5: Journal entry numbering ignores BusinessRules prefix/sequence

**File:** `src/lib/journalUtils.ts` line 85

`entryNumber` is generated as `JE-${Date.now().toString(36).toUpperCase()}` — a timestamp-based hash. This ignores `journal_prefix` and `journal_next_seq` from tenant_settings.

**Fix:** Accept optional `prefix` and `nextSeq` params in the journal creation function. When provided, generate `{prefix}-{year}-{seq}`. Callers should fetch tenant_settings and pass these values.

### Bug 6: PayrollParameters missing unemployment_employer_rate

**File:** `src/pages/tenant/PayrollParameters.tsx` lines 26-85

The `FormState` and `defaultForm` include `unemployment_employee_rate` but not `unemployment_employer_rate`. The DB column doesn't exist either (confirmed from schema). Serbian law requires employer unemployment contribution (currently 0.75%).

**Fix:** Add migration for `unemployment_employer_rate` column on `payroll_parameters`. Add to FormState, defaultForm (0.75), FormFields UI, and formToPayload/paramsToForm converters.

### Bug 7: PPP-PD review page missing OVP/OLA/BEN code validation

**File:** `src/pages/tenant/PppdReview.tsx`

The PPP-PD XML requires valid OVP (vrsta prihoda), OLA, and BEN codes for each employee. The review page shows them but doesn't validate or warn when they're empty.

**Fix:** Add a validation banner counting items with missing `ovp_code` and display a warning before XML generation.

### Bug 8: PPP-PO XML missing escapeXml on employee names

**File:** `src/pages/tenant/reports/PPPPO.tsx` lines 92-109

Employee names containing `&`, `<`, or `>` would produce malformed XML. Same class of bug as CR-HIGH-4.

**Fix:** Add inline `escapeXml` utility and wrap `r.name`, `r.jmbg` in the XML template.

### Bug 9: CIT Tax Return missing adjustments UI

**File:** `src/pages/tenant/CitTaxReturn.tsx`

The `cit_tax_returns` table has `tax_adjustments_increase`, `tax_adjustments_decrease`, `tax_credits`, `adjustment_details`, and `notes` columns, but none are exposed in the UI. Users can't enter non-deductible expenses or tax incentives.

**Fix:** Add an expandable "Tax Adjustments" section with inputs for:
- `tax_adjustments_increase` (non-deductible expenses)
- `tax_adjustments_decrease` (tax incentives)  
- `tax_credits` (investment credits, etc.)
- `adjustment_details` (textarea for notes)

Recalculate: `taxable_base = Math.max(0, accounting_profit + increase - decrease)`, `final_tax = Math.max(0, tax_amount - credits)`.

### Bug 10: PayrollParameters missing PPP-PD parameter fields

**File:** `src/pages/tenant/PayrollParameters.tsx`

The `payroll_parameters` table is missing fields needed for accurate PPP-PD generation:
- `holiday_multiplier` (for public holiday work)
- `sickness_rate_employer` (first 30 days employer-paid sick leave rate, typically 65%)
- `annual_leave_daily_rate` (vacation pay calculation base)

**Fix:** Add migration for these 3 columns. Add to FormState/FormFields/payload converters.

### Execution Order

1. CIT Tax Return full upgrade: Bugs 1, 2, 9 — `CitTaxReturn.tsx`
2. BilansStanja class grouping fix: Bug 3 — `BilansStanja.tsx`
3. Sequential numbering: Bugs 4, 5 — `InvoiceForm.tsx`, `journalUtils.ts`
4. PayrollParameters expansion: Bugs 6, 10 — migration + `PayrollParameters.tsx`
5. PPP-PD/PPP-PO fixes: Bugs 7, 8 — `PppdReview.tsx`, `PPPPO.tsx`

### Files Modified

| File | Bugs |
|------|------|
| `src/pages/tenant/CitTaxReturn.tsx` | 1, 2, 9 |
| `src/pages/tenant/BilansStanja.tsx` | 3 |
| `src/pages/tenant/InvoiceForm.tsx` | 4 |
| `src/lib/journalUtils.ts` | 5 |
| `src/pages/tenant/PayrollParameters.tsx` | 6, 10 |
| `src/pages/tenant/PppdReview.tsx` | 7 |
| `src/pages/tenant/reports/PPPPO.tsx` | 8 |
| 1-2 database migrations | 6, 10 |


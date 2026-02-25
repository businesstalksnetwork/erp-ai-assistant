

# Continue Payroll Upgrade: Phase 2

## What Was Already Done (Phase 1)
- Created `payroll_income_categories` table with 12 seeded categories and per-category tax/contribution rates
- Created `payroll_payment_types` table with standard payment type codes
- Upgraded `calculate_payroll_for_run` RPC with per-category rates, beneficiary coefficients, and subsidy calculations
- Added `payroll_category_id`, `bank_account_iban`, `bank_name`, `recipient_code`, `pib` columns to `employees` table
- Added `payroll_category_id`, `ovp_code`, `ola_code`, `ben_code`, `subsidy_amount`, `municipal_tax` columns to `payroll_items` table
- Created PayrollCategories page with CRUD UI
- Updated GL posting logic in Payroll.tsx

## What Remains (This Phase)

Based on the PRD, the following gaps need to be closed:

### 1. Employee Detail — Payroll Data Fields
The `employees` table now has `payroll_category_id`, `bank_account_iban`, `bank_name`, `recipient_code`, and `pib` columns, but the EmployeeDetail edit form does not expose them. The personal info tab also doesn't display them.

**Changes to `src/pages/tenant/EmployeeDetail.tsx`:**
- Add payroll-specific fields to `EmployeeForm` interface: `payroll_category_id`, `bank_account_iban`, `bank_name`, `recipient_code`, `pib`
- Add a "Payroll Data" section in the Personal Info tab showing: category name, IBAN, bank, recipient code, PIB
- Add corresponding inputs in the Edit Dialog with a dropdown for `payroll_category_id` (fetched from `payroll_income_categories`)
- Include these fields in the update mutation payload

### 2. Payment Types Management Page
The `payroll_payment_types` table exists with a seed function but has no UI. Create a new page similar to PayrollCategories.

**New file: `src/pages/tenant/PayrollPaymentTypes.tsx`**
- Table listing all payment types (code, name, type, hourly/benefits flags, rate multiplier, nontaxable)
- "Seed defaults" button when empty
- CRUD dialog for add/edit
- Link from Payroll page

**Route: Add to `src/routes/hrRoutes.tsx`** at `/hr/payroll/payment-types`

### 3. PPP-PD XML Generation
The PRD requires generating a PPP-PD tax declaration in XML format. Create an edge function that, given a payroll run ID, generates a valid PPP-PD XML.

**New edge function: `supabase/functions/generate-pppd-xml/index.ts`**
- Accepts `payroll_run_id`
- Fetches payroll items with employee JMBG, OVP/OLA/BEN codes, amounts
- Validates: JMBG checksum, required fields, arithmetic consistency
- Generates XML per the e-Porezi XSD schema
- Returns the XML as a downloadable file

**UI addition in `Payroll.tsx`:**
- Add a "PPP-PD" download button on approved/paid payroll runs

### 4. Bank Payment Orders
The PRD requires generating bank payment orders for salary disbursement.

**New edge function: `supabase/functions/generate-payment-orders/index.ts`**
- Accepts `payroll_run_id`
- Generates CSV/XML with individual payment orders per employee (IBAN, amount, reference)
- Format compatible with Serbian banks (poziv na broj = JMBG/month/year)

**UI addition in `Payroll.tsx`:**
- Add a "Bank Orders" download button on approved payroll runs

### 5. Payroll Run Summary Enhancements
- Show subsidy totals, employer contribution breakdown, and municipal tax in the run summary section
- Show OVP/OLA/BEN codes per employee in the expanded payroll items table

### 6. Update Payroll Page Navigation
- Add link to Payment Types page alongside the existing Categories link

## Technical Details

- **Employee form extension**: 5 new fields in the edit dialog, payroll_income_categories dropdown query
- **PayrollPaymentTypes page**: ~180 lines, mirrors PayrollCategories pattern
- **PPP-PD edge function**: XML template with e-Porezi compatible structure, JMBG validation algorithm
- **Payment orders edge function**: CSV generation with bank-compatible format
- **No breaking changes** to existing RPC or schema — purely additive

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/tenant/EmployeeDetail.tsx` | Add payroll fields to form + display |
| `src/pages/tenant/PayrollPaymentTypes.tsx` | New page |
| `src/pages/tenant/Payroll.tsx` | Add PPP-PD button, payment orders button, subsidy display, payment types link |
| `src/routes/hrRoutes.tsx` | Add payment-types route |
| `supabase/functions/generate-pppd-xml/index.ts` | New edge function |
| `supabase/functions/generate-payment-orders/index.ts` | New edge function |


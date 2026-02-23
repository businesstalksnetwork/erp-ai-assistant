

# Law Compliance Updates (Excluding Payroll Defaults)

Skipping PayrollParameters defaults as requested. Also, **contribution base clamping is already implemented** in the `calculate_payroll_for_run` RPC (lines 138-139 use `GREATEST`/`LEAST` to clamp). That leaves 3 items.

---

## Step 1: CIT Accrual in Year-End Closing (Small)

**Problem:** The `perform_year_end_closing` RPC closes revenue/expense to retained earnings (account 3000) but does not accrue Corporate Income Tax (15% per Serbian law).

**Changes:**
- Update `perform_year_end_closing` RPC via new migration:
  - After computing `v_net_income`, if positive, calculate CIT at 15%: `v_cit := v_net_income * 0.15`
  - Look up account `7200` (Tax Expense) and `4810` (CIT Payable)
  - Insert two journal lines: Debit 7200, Credit 4810
  - Reduce retained earnings posting by the CIT amount
  - If accounts 7200/4810 don't exist, skip CIT accrual gracefully (RAISE NOTICE)
- Update `YearEndClosing.tsx` preview to show the CIT accrual line when net income is positive

**Files:**
- New migration SQL
- `src/pages/tenant/YearEndClosing.tsx` (add CIT preview row)

---

## Step 2: PDPA (Serbian GDPR) Compliance Module (Medium-Large)

**Problem:** No data protection features exist for consent tracking, data export, or anonymization.

### 2a. Database Schema (Migration)
- Create `data_subject_requests` table:
  - `id`, `tenant_id`, `request_type` (access/erasure/portability/rectification), `subject_type` (employee/contact/lead), `subject_id`, `status` (pending/processing/completed/rejected), `requested_at`, `completed_at`, `notes`, `requested_by`
- Create `consent_records` table:
  - `id`, `tenant_id`, `subject_type`, `subject_id`, `purpose` (marketing/analytics/processing), `consented_at`, `withdrawn_at`, `legal_basis`
- Add `data_retention_expiry` column to `contacts` and `employees` tables
- Enable RLS on both new tables

### 2b. Data Protection Settings Page
- New file: `src/pages/tenant/DataProtection.tsx`
  - Section 1: Data controller info display (company name, DPO contact from settings)
  - Section 2: Data Subject Requests list with create/process workflow
  - Section 3: Consent records viewer
  - Section 4: "Export All Data" button per contact/employee (downloads JSON)
  - Section 5: "Anonymize" button that replaces PII with hashed placeholders while preserving accounting references

### 2c. Route and Navigation
- Add route to `src/routes/settingsRoutes.tsx`
- Add navigation entry in the settings/HR sidebar

### 2d. Anonymization Logic
- Anonymize replaces: first_name, last_name, email, phone, address with anonymized values
- Preserves: IDs, tenant references, financial amounts (for accounting integrity)
- Marks record with `anonymized_at` timestamp

---

## Step 3: Voucher PDV Treatment (Medium)

**Problem:** April 2026 VAT overhaul introduces single-purpose vs multi-purpose voucher rules.

### 3a. Database Changes (Migration)
- Add `voucher_type` enum column to `invoices` table: `NULL` (not a voucher), `single_purpose`, `multi_purpose`
- Add `voucher_type` column to `pos_receipts` table
- Add `voucher_original_receipt_id` to link redemption to original sale

### 3b. Invoice Form Update
- `src/pages/tenant/InvoiceForm.tsx`: Add optional voucher type selector (only shown when payment method is voucher)
- Single-purpose: VAT calculated at time of voucher sale (normal flow)
- Multi-purpose: VAT field set to 0 at sale, VAT charged at redemption

### 3c. POS Terminal Update
- `src/pages/tenant/PosTerminal.tsx`: When payment method is "voucher", show voucher type toggle
- Multi-purpose voucher sales: skip VAT in fiscal receipt, mark for later
- Redemption flow: look up original voucher, apply correct VAT rate

### 3d. Fiscalization Update
- `supabase/functions/fiscalize-receipt/index.ts`: Handle `voucher_type` field
  - Multi-purpose sale: send with tax category `O` (outside scope)
  - Redemption: send with correct `S10`/`S20` tax category

---

## Technical Notes

- All database changes via Supabase migrations with RLS policies
- New translations added for all PDPA and voucher UI strings (both EN and SR)
- CIT rate (15%) sourced from a constant; could later be made configurable via payroll_parameters or a dedicated tax_settings table
- Contribution base clamping is already correctly implemented -- no changes needed

## Estimated Effort
| Step | Description | Effort |
|------|-------------|--------|
| 1 | CIT accrual in year-end closing | ~30 min |
| 2 | PDPA compliance module | ~3 hours |
| 3 | Voucher PDV treatment | ~2 hours |


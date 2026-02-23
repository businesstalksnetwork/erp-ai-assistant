
# Law Compliance Updates — COMPLETED ✅

All 3 steps implemented successfully.

## Step 1: CIT Accrual in Year-End Closing ✅
- Updated `perform_year_end_closing` RPC to accrue 15% CIT (Debit 7200, Credit 4810)
- Gracefully skips if accounts 7200/4810 don't exist
- Reduces retained earnings by CIT amount
- Updated `YearEndClosing.tsx` preview with CIT accrual table

## Step 2: PDPA (Serbian GDPR) Compliance Module ✅
- Created `data_subject_requests` and `consent_records` tables with RLS
- Added `data_retention_expiry` and `anonymized_at` columns to contacts/employees
- Built `DataProtection.tsx` page with tabs for requests and consent records
- Added route at `/settings/data-protection` and nav entry
- Supports: create requests, export data (JSON), anonymize subjects

## Step 3: Voucher PDV Treatment ✅
- Added `voucher_type` column to invoices and pos_transactions
- Added voucher_original_invoice_id/transaction_id for redemption linking
- Updated InvoiceForm.tsx with voucher type selector
- Updated PosTerminal.tsx with voucher type buttons when payment=voucher
- Updated fiscalize-receipt edge function: multi-purpose vouchers use tax category "O"

## Skipped (per user request)
- PayrollParameters defaults (28,423 → 34,221, PIO 11%→12%, etc.)
- Contribution base clamping (already implemented in RPC)

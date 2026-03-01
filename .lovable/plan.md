

# Phase D: Differentiation Features

## 4 Items to Implement

### 1. BANK-4: Wire Transfer Templates
**What:** Save and reuse payment order templates for recurring transfers (rent, utilities, salaries).

**How:**
- Migration: `payment_templates` table (tenant_id, name, recipient_name, recipient_account, amount, currency, payment_code, model, reference_pattern, partner_id)
- Create `src/pages/tenant/PaymentTemplates.tsx` — CRUD list of saved templates
- Add "Save as Template" button on `PaymentOrderForm.tsx` and "Fill from Template" selector
- Auto-suggest creating a template on first payment to a new partner
- Route: `accounting/payment-templates`

### 2. BANK-6: Interest Auto-Accrual
**What:** Automated monthly interest calculation for loans and overdue receivables per Serbian ZoOO Art. 278 (reference rate + 8%).

**How:**
- Migration: `interest_accruals` table (tenant_id, source_type [loan/receivable], source_id, period_start, period_end, principal, rate, accrued_amount, posted, journal_entry_id)
- Create `src/pages/tenant/InterestAccrual.tsx` — period selector, preview of calculated interest, batch post button
- GL posting: DR 5620 / CR 4960 (loan interest expense), DR 2042 / CR 6720 (default interest income on overdue AR)
- Pulls active loans from `loans` table and overdue invoices from `invoices` where `due_date < today` and `status != 'paid'`
- Route: `accounting/interest-accrual`

### 3. BANK-7b: Cesija & Asignacija
**What:** Transfer of receivables (cesija) and delegation of payables (asignacija) — common Serbian B2B debt instruments.

**How:**
- Migration: `cesije` table (tenant_id, original_debtor_id, new_debtor_id, amount, currency, date, status, journal_entry_id, notes) + `asignacije` table (same structure with original_creditor_id, new_creditor_id)
- Create `src/pages/tenant/CesijaAsignacija.tsx` with tabs for each type
- Cesija GL: DR 2040 (new debtor) / CR 2040 (original debtor)
- Asignacija GL: DR 4350 (original supplier) / CR 4350 (new supplier)
- Partner selector for all 3 parties, amount validation against open items
- Route: `accounting/cesija-asignacija`

### 4. DMS-6: OCR Integration
**What:** Extract text from uploaded images/scanned PDFs and store for search.

**How:**
- The `documents` table already has an `ocr_text` column and `invoice-ocr` edge function exists
- Create `src/components/shared/OcrButton.tsx` — button that sends document image to the existing `invoice-ocr` edge function (or a new lighter `document-ocr` edge function)
- Create edge function `document-ocr/index.ts` — accepts base64 image, uses Lovable AI gateway to extract text (simpler prompt than invoice-specific OCR), stores result in `documents.ocr_text`
- Add OCR button to document detail/preview in Drive
- Include `ocr_text` in full-text search index (already partially set up in Phase B migration)

---

## Summary

| Item | New Files | Migration Tables | Edge Functions |
|------|-----------|-----------------|----------------|
| BANK-4 | 1 page | 1 table | 0 |
| BANK-6 | 1 page | 1 table | 0 |
| BANK-7b | 1 page | 2 tables | 0 |
| DMS-6 | 1 component | 0 | 1 |
| **Total** | **4 files** | **4 tables** | **1 edge function** |


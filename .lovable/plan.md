

# Implementation Plan: Bank Accounts Module Upgrade (PRD)

This PRD describes a comprehensive bank account management and document import system. Comparing against what already exists, here is what needs to be built.

## What Already Exists

```text
FEATURE                          STATUS
────────────────────────────     ──────
bank_accounts table              ✅ Basic (name, number, currency, primary, active, gl_account_id)
bank_statements table            ✅ With import, number, balances, status
bank_statement_lines table       ✅ With matching (invoice, supplier_invoice, journal_entry)
Auto-matching algorithm          ✅ 4-step confidence scoring (amount, reference, partner, date)
Manual matching UI               ✅ Dialog-based
GL posting of matched lines      ✅ Via createCodeBasedJournalEntry
CSV import                       ✅ Basic (auto-detect columns)
Bank reconciliation tables       ✅ bank_reconciliations + bank_reconciliation_lines
BankAccounts page                ✅ CRUD table with search, legal entity, primary flag
BankStatements page              ✅ List + detail + import + match + post
```

## What's Missing (from the PRD)

### PHASE 1: Enhanced Bank Account Model

**1.1 New columns on `bank_accounts`:**
- `iban` (text) — IBAN number with RS validation
- `account_type` (text) — CURRENT, FOREIGN, SAVINGS, LOAN
- `swift_code` (text) — SWIFT/BIC code
- `bank_code` (text, 3 chars) — NBS bank code (auto-detected from IBAN)
- `opening_date` (date)
- `closing_date` (date)
- `purpose` (text) — Account purpose description
- `updated_at` (timestamptz)

**1.2 New table: `banks` (bank registry)**
- id, name, swift_code, bank_code (3-digit NBS), country, email_domain
- Seed with major Serbian banks (Intesa, UniCredit, Raiffeisen, OTP, Addiko, Erste, ProCredit, Halkbank, etc.)

**1.3 Updated BankAccounts UI:**
- Card view (not just table) showing IBAN, type, currency, last sync status
- IBAN validation (Mod 97 algorithm) on form
- Auto-detect bank from IBAN first 3 digits
- Bank selector from `banks` registry
- Quick action buttons: "Import statement" | "Transactions" | "Settings"

### PHASE 2: Document Import Pipeline

**2.1 New table: `document_imports`**
- id, tenant_id, source_type (EMAIL/MANUAL_UPLOAD), original_filename, file_format (CAMT053/MT940/NBS_XML/CSV/PDF), file_size_bytes, sha256_hash, storage_path, status (PENDING/PROCESSING/PARSED/MATCHED/ERROR/QUARANTINE), parser_used, ocr_confidence_avg, transactions_count, bank_account_id, error_message, imported_at, processed_at

**2.2 Enhanced CSV Parser with bank-specific profiles:**
- New table: `csv_import_profiles` — id, tenant_id, bank_id, profile_name, separator, encoding, header_row, date_format, decimal_separator, column_mappings (jsonb)
- Pre-seeded profiles for major Serbian banks
- Profile selection during import instead of auto-detect only

**2.3 XML Parser edge function: `parse-bank-xml`**
- Support camt.053.001.02, camt.053.001.06, MT940, NBS-XML
- Extract: IBAN, statement number, period, opening/closing balance, all transactions with counterparty details
- SHA-256 deduplication

**2.4 Document Import UI:**
- Drag & drop upload zone (XML, CSV, PDF)
- Import history with status badges
- Quarantine tab for failed imports
- Bank account auto-detection from IBAN in document

### PHASE 3: Enhanced Matching & Reconciliation

**3.1 Additional columns on `bank_statement_lines`:**
- `value_date` (date) — Settlement date
- `counterparty_iban` (text)
- `counterparty_bank` (text)  
- `transaction_type` (text) — WIRE, DIRECT_DEBIT, FEE, CARD, INTERNAL, SALARY, TAX
- `match_confidence` (numeric) — Store the confidence score
- `document_import_id` (uuid FK) — Link back to source document

**3.2 Enhanced match_status enum:**
- Add `suggested` and `excluded` statuses (suggested already used in code but not formally defined)

**3.3 Bulk match confirmation UI:**
- "Confirm all suggestions" button for batch approval
- Filter by match_status in transaction list

---

## Recommended Implementation Order

```text
STEP   SCOPE                                    EFFORT
─────  ──────────────────────────────────────    ──────
  1    DB: Enhance bank_accounts + create        Medium
       banks registry + document_imports +
       csv_import_profiles + enhance
       bank_statement_lines

  2    UI: Upgrade BankAccounts page to card      Medium
       view with IBAN validation, bank
       registry selector, account types

  3    Edge function: parse-bank-xml for          Large
       camt.053 / MT940 / NBS-XML parsing

  4    UI: Document Import page with drag &       Medium
       drop, import history, quarantine

  5    UI: Enhanced BankStatements with            Small
       confidence scores, bulk confirm,
       transaction type badges
```

## What is Out of Scope (per PRD v1.0)
- Email/IMAP integration (Phase 3 of PRD — complex, requires external services)
- PDF/OCR processing (Phase 4 of PRD — requires Tesseract, heavy infra)
- Direct bank API (PSD2/Open Banking)
- These are noted for future phases.

## Technical Details

**Database migration** will:
1. Create `banks` table with RLS + seed 10 Serbian banks
2. Add columns to `bank_accounts`: iban, account_type, swift_code, bank_code, opening_date, closing_date, purpose, bank_id FK, updated_at
3. Create `document_imports` table with RLS
4. Create `csv_import_profiles` table with RLS + seed default profiles
5. Add columns to `bank_statement_lines`: value_date, counterparty_iban, counterparty_bank, transaction_type, match_confidence, document_import_id

**Files to create:**
- `supabase/functions/parse-bank-xml/index.ts` — XML parser for camt.053/MT940/NBS
- `src/pages/tenant/DocumentBrowser.tsx` — Already exists, needs enhancement or new `BankDocumentImport.tsx`

**Files to modify:**
- `src/pages/tenant/BankAccounts.tsx` — Card view, IBAN validation, bank registry, account types
- `src/pages/tenant/BankStatements.tsx` — Confidence badges, bulk confirm, document import link
- `src/pages/tenant/AccountingHub.tsx` — Add "Document Import" link
- `src/routes/accountingRoutes.tsx` — Add new route if needed
- `src/integrations/supabase/types.ts` — Auto-updated by migration




# Accounting Module Fix Plan — Batch 1 & 2

Based on the detailed status review, here's the implementation plan organized by priority. The 11 broken/missing issues are grouped into two batches.

---

## Batch 1: Quick UI Fixes (6 tasks)

### 1. Add POPDV Field Dropdown to Invoice Lines
- **File**: `src/pages/tenant/InvoiceForm.tsx`
- Add a `<Select>` column for `popdv_field` in the line items table (after item_type column)
- Options: sections 1-11 matching Serbian POPDV regulation (`1` – Promet dobara, `2` – Promet usluga, `3` – PDV 20%, `3a` – PDV 10%, etc.)
- Data already saves to DB (`popdv_field` column exists on `invoice_lines`)

### 2. Add eFaktura Category Dropdown to Invoice Lines
- **File**: `src/pages/tenant/InvoiceForm.tsx`
- Add a `<Select>` column for `efaktura_category` in the same line items table
- Options: standard eFaktura categories (`S10`, `S20`, `AE10`, `AE20`, `Z`, `E`, `O`, `SS`)
- Data already saves to DB (`efaktura_category` column exists)

### 3. Hide Voucher Type from Invoice Form
- **File**: `src/pages/tenant/InvoiceForm.tsx`
- Remove the voucher type `<Select>` block (lines ~474-486) from the invoice form
- Keep the field in the data model for POS terminal use only
- Set `voucher_type: null` in `invoiceData` instead of binding to state

### 4. Add Account Typeahead Search in Journal Entries
- **File**: `src/pages/tenant/JournalEntries.tsx`
- Replace the plain `<Select>` for account selection with a searchable combobox (using `cmdk` which is already installed)
- Allow typing account code or name to filter
- Show `code — name` format in results

### 5. Add 4-Digit Minimum Account Validation in Journal Entries
- **File**: `src/pages/tenant/JournalEntries.tsx`
- In `createMutation`, before submission, validate that every selected account has a code ≥ 4 characters
- Look up the account from the loaded `accounts` array by ID, check `code.length >= 4`
- Show toast error if validation fails: "Knjiženje dozvoljeno samo na konta sa 4+ cifara"

### 6. Implement Bank Statement Auto-Numbering
- **File**: `src/pages/tenant/BankStatements.tsx`
- When creating a new statement via CSV import, auto-generate `statement_number` in format `IZ{accountSuffix}-{sequentialNumber}` (e.g., `IZ567-1`, `IZ567-2`)
- Query existing statements for the same bank account to determine next sequence number
- Pre-fill in the import form, allow manual override

---

## Batch 2: Critical Workflows (4 tasks)

### 7. Wire Up Invoice "Proknjizi" (Post) Button from Invoices List
- **File**: `src/pages/tenant/Invoices.tsx`
- The Post button already exists in the actions column (calls `postMutation` via `process_invoice_post` RPC)
- The `postMutation` already calls the RPC + updates status + triggers SEF
- **Issue**: The `postMutation` exists and works. Verify it's correctly shown for `draft` status invoices
- Actually, reviewing the code — the Post button IS wired up (line ~225 in the actions render). The button calls `checkApproval → setPostDialog → postMutation.mutate`. This appears functional. Mark as **already working** and verify.

### 8. Fix Legal Entity Auto-Hide When Single Entity
- **File**: `src/pages/tenant/InvoiceForm.tsx`
- Legal entity card (lines 491-506) already auto-selects + disables when `legalEntities.length === 1`
- Enhance: hide the entire Card when there's only 1 legal entity (no need to show it at all)

### 9. Build Partner Quick-Add Sidebar
- **File**: Create `src/components/accounting/PartnerQuickAdd.tsx`
- **File**: Update `src/pages/tenant/InvoiceForm.tsx`
- Add a "+" button next to the partner dropdown that opens a Sheet/Dialog
- Fields: Name, PIB, MB, Address, City, Country, Contact email/phone
- On save, insert into `partners` table, auto-select in the invoice form
- Future enhancement: APR lookup by PIB (separate task)

### 10. Fix Bank Statement XML Import
- **File**: `supabase/functions/parse-bank-xml/index.ts`
- The edge function already handles CAMT.053, NBS_XML, and MT940 formats
- The `BankDocumentImport.tsx` page correctly invokes it for `.xml` files
- **Issue may be**: the simple regex-based XML parser fails on real-world Serbian bank XML files with namespaces, CDATA, or different tag structures
- Enhance NBS XML parser to handle additional tag variants: `<Nalog>`, `<Prenos>`, `<PrometStavka>`, and bank-specific XML schemas from major Serbian banks (Intesa, OTP, Raiffeisen, Komercijalna)
- Add better error reporting to surface parse failures in the UI

---

## Technical Notes

- **POPDV section options** follow the official form structure: sections 1-11 covering different transaction types
- **eFaktura categories** follow Serbian eFaktura specification aligned with EN16931
- **Account typeahead** will use the existing `cmdk` (Command Menu) dependency — no new packages needed
- **Bank statement numbering** uses the Serbian convention where the last 3 digits of the bank account number form the suffix
- All UI changes use existing Shadcn/UI components; no new dependencies required


# Bank Management

## Pages (Routes)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/accounting/bank-accounts` | BankAccounts | Bank account CRUD |
| `/accounting/bank-statements` | BankStatements | Statement import, line matching, GL posting |
| `/accounting/document-import` | BankDocumentImport | Bank XML document import |

## Database Tables

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `banks` | id, bank_code, name, swift_code, country | Bank master data (shared, no tenant_id) |
| `bank_accounts` | id, tenant_id, bank_id, account_number, iban, bank_name, currency, gl_account_id, legal_entity_id, is_primary | Tenant's bank accounts linked to GL |
| `bank_statements` | id, tenant_id, bank_account_id, statement_date, opening_balance, closing_balance, status | Statement headers |
| `bank_statement_lines` | id, tenant_id, statement_id, line_date, amount, direction, partner_name, payment_reference, match_status, matched_invoice_id, matched_supplier_invoice_id, journal_entry_id, document_import_id | Individual transactions |
| `bank_reconciliations` | id, tenant_id, bank_account_id, statement_id, opening_balance, closing_balance, status | Reconciliation sessions |
| `bank_reconciliation_lines` | id, reconciliation_id, statement_line_id, journal_entry_id, match_type, confidence | Matched pairs |
| `account_mappings` | id, tenant_id, bank_account_id, gl_account_id, mapping_type, valid_from, valid_to | Bank→GL account overrides |
| `document_imports` | id, tenant_id, file_name, import_type, status | Imported document tracking |

## RPC Functions

| RPC | Called By | Purpose |
|-----|----------|---------|
| `find_posting_rule` | `BankStatements.tsx` via `postingRuleEngine.ts` | Waterfall match for automated GL posting |

## Edge Functions

| Function | Purpose |
|----------|---------|
| `parse-bank-xml` | Parse Serbian bank XML formats (Halcom, etc.) into statement lines |

## GL Posting Flow (BankStatements.tsx)

```
User selects statement line → chooses payment model (e.g., CUSTOMER_PAYMENT)

1. findPostingRule(tenantId, modelCode, bankAccountId, currency, partnerType)
   ↓ (waterfall: exact → drop partner → drop currency → drop bank → null)

2. IF rule found:
     resolvePostingRuleToJournalLines(tenantId, rule.lines, amount, {
       bankAccountGlCode: bankAccount.gl_code,
       partnerReceivableCode: "2040",
       partnerPayableCode: "4350",
       ...
     })
   ELSE (fallback):
     Hardcoded lines: debit 2410, credit 2040 (customer) or debit 4350, credit 2410 (vendor)

3. createCodeBasedJournalEntry({
     tenantId, entryDate, description, reference,
     legalEntityId,
     lines: resolvedLines
   })

4. Update bank_statement_lines.journal_entry_id = new journal ID
5. Update bank_statement_lines.match_status = 'matched'
```

## Auto-Match Scoring

Statement lines are matched to invoices using:
- Payment reference vs invoice number
- Amount exact match
- Partner name fuzzy match
- `match_confidence` score (0-100) stored on `bank_statement_lines`
- `match_status`: unmatched → suggested → matched → posted

## Cross-Module Dependencies

### Reads From
- **Accounting**: `chart_of_accounts` (GL account resolution), `invoices` (matching), `supplier_invoices` (matching)
- **Partners**: invoice partner data for matching
- **Posting Rules**: `posting_rules`, `posting_rule_lines`, `payment_models`, `account_mappings`

### Writes To
- **Accounting**: `journal_entries` + `journal_lines` via posting
- **Invoices**: updates `invoices.status` when payment matched
- **Supplier Invoices**: updates `supplier_invoices.status` when payment matched

## Known Gaps
- Auto-match only uses simple reference/amount matching — no ML scoring yet
- Reconciliation UI exists but not fully connected to auto-match results
- Multi-currency statement lines not yet supported in posting rule resolution

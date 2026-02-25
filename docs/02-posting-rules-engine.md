# Posting Rules Engine (Knjiženja)

## Architecture Overview

The system has **two parallel GL posting paths**:

```
┌─────────────────────────────────────────────────────────────┐
│  NEW ENGINE (posting_rules + posting_rule_lines)            │
│                                                             │
│  BankStatements.tsx                                         │
│    → findPostingRule(tenantId, modelCode, bankAcct, ...)    │
│    → resolvePostingRuleToJournalLines(lines, amount, ctx)   │
│    → createCodeBasedJournalEntry(...)                       │
│                                                             │
│  PostingRules.tsx (Settings UI)                              │
│    → seed_default_posting_rules(p_tenant_id)                │
│    → CRUD on posting_rules, posting_rule_lines              │
│    → CRUD on account_mappings                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  LEGACY ENGINE (posting_rule_catalog + hardcoded codes)      │
│                                                             │
│  Payroll.tsx → posting_rule_catalog lookup → hardcoded GL   │
│  SupplierInvoices.tsx → hardcoded 5xxx/2100                 │
│  FixedAssets.tsx → hardcoded 8100/1290                      │
│  FxRevaluation.tsx → hardcoded                              │
│  CashRegister.tsx → hardcoded                               │
│  Deferrals.tsx → hardcoded                                  │
│  Kompenzacija.tsx → hardcoded                               │
│  IntercompanyTransactions.tsx → hardcoded                   │
└─────────────────────────────────────────────────────────────┘

Both paths converge to:
  createCodeBasedJournalEntry() → create_journal_entry_with_lines RPC
```

## Database Tables

### New Engine
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `payment_models` | id, tenant_id, code, name, is_active | Transaction type catalog (CUSTOMER_PAYMENT, SALARY_PAYMENT, etc.) |
| `posting_rules` | id, tenant_id, model_id, name, priority, bank_account_id, currency, partner_type, is_active | Rule header with waterfall matching criteria |
| `posting_rule_lines` | id, rule_id, line_number, side (DEBIT/CREDIT), account_source (FIXED/DYNAMIC), account_id, dynamic_source, amount_source, amount_factor, description_template, is_tax_line | Line-level posting template |
| `account_mappings` | id, tenant_id, bank_account_id, gl_account_id, mapping_type (PRIMARY/CLEARING/FEE), valid_from, valid_to | Bank account → GL account overrides |

### Legacy Engine
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `posting_rule_catalog` | id, tenant_id, rule_code, debit_account, credit_account, description | Simple debit/credit lookup by rule code |
| `payroll_pt_gl_overrides` | id, tenant_id, payment_type_code, legal_entity_id, debit_account, credit_account | Per-entity GL overrides for payroll |

## RPC Functions

| RPC | Purpose | Called By |
|-----|---------|----------|
| `find_posting_rule` | Waterfall match: model_code → bank_account → currency → partner_type → fallback | `postingRuleEngine.ts` |
| `seed_default_posting_rules` | Idempotent seed of 14 standard rules | `PostingRules.tsx` |

## Key Source Files

| File | Role |
|------|------|
| `src/lib/postingRuleEngine.ts` | `findPostingRule()`, `resolvePostingRuleToJournalLines()`, `simulatePosting()`, dynamic context types |
| `src/lib/journalUtils.ts` | `createCodeBasedJournalEntry()`, `findAccountByCode()`, `checkFiscalPeriodOpen()` |
| `src/pages/tenant/PostingRules.tsx` | Settings UI: rules CRUD, lines CRUD, account mappings, rule seeding, simulation |
| `src/pages/tenant/BankStatements.tsx` | Primary consumer of new engine (findPostingRule → resolve → create) |

## 35 Payment Models

### Original Bank Statement Models (14)
| Code | Description |
|------|-------------|
| CUSTOMER_PAYMENT | Customer pays invoice |
| VENDOR_PAYMENT | Pay supplier invoice |
| ADVANCE_RECEIVED | Advance from customer |
| ADVANCE_PAID | Advance to supplier |
| SALARY_PAYMENT | Net salary bank transfer |
| TAX_PAYMENT | Tax authority payment |
| VAT_PAYMENT | VAT payment |
| VAT_REFUND | VAT refund received |
| BANK_FEE | Bank charges |
| INTER_ACCOUNT_TRANSFER | Own accounts transfer |
| FX_REVALUATION | Currency revaluation |
| INTERNAL_COMPENSATION | Mutual debt offset |
| CUSTOMER_REFUND | Refund to customer |
| VENDOR_REFUND | Refund from supplier |

### Extended Models (21) — Added 2026-02-25
| Code | Module | Description |
|------|--------|-------------|
| GOODS_RECEIPT | GoodsReceipts.tsx | Inventory receipt GL posting |
| SUPPLIER_INVOICE_POST | SupplierInvoices.tsx | Invoice approval GL posting |
| SUPPLIER_INVOICE_PAYMENT | SupplierInvoices.tsx | Invoice payment GL posting |
| CUSTOMER_RETURN_RESTOCK | Returns.tsx | COGS reversal on customer return |
| CUSTOMER_RETURN_CREDIT | Returns.tsx | Credit note to customer |
| SUPPLIER_RETURN | Returns.tsx | Return goods to supplier |
| CREDIT_NOTE_ISSUED | Returns.tsx | Credit note issuance |
| LOAN_PAYMENT_PAYABLE | Loans.tsx | Loan repayment |
| LOAN_PAYMENT_RECEIVABLE | Loans.tsx | Loan disbursement |
| COMPENSATION | Kompenzacija.tsx | Mutual debt offset |
| ASSET_DEPRECIATION | FixedAssets.tsx | Monthly depreciation |
| ASSET_DISPOSAL | FixedAssets.tsx | Asset disposal/sale |
| FX_GAIN | FxRevaluation.tsx | Foreign exchange gain |
| FX_LOSS | FxRevaluation.tsx | Foreign exchange loss |
| DEFERRAL_REVENUE | Deferrals.tsx | Deferred revenue recognition |
| DEFERRAL_EXPENSE | Deferrals.tsx | Deferred expense recognition |
| CASH_IN | CashRegister.tsx | Cash register receipt |
| CASH_OUT | CashRegister.tsx | Cash register disbursement |
| INTERCOMPANY_POST | IntercompanyTransactions.tsx | Intercompany GL posting |
| PAYROLL_NET | Payroll.tsx | Net salary posting |
| PAYROLL_TAX | Payroll.tsx | Tax & contributions posting |

## Dynamic Account Sources

When `account_source = 'DYNAMIC'`, the account is resolved at runtime from context:

| Dynamic Source | Context Key | Typical Use |
|---------------|-------------|-------------|
| BANK_ACCOUNT | bankAccountGlCode | Bank's linked GL account |
| PARTNER_RECEIVABLE | partnerReceivableCode | Customer receivable (e.g., 2040) |
| PARTNER_PAYABLE | partnerPayableCode | Vendor payable (e.g., 4350) |
| EMPLOYEE_NET | employeeNetCode | Employee net salary account |
| TAX_PAYABLE | taxPayableCode | Tax liability account |
| CONTRIBUTION_PAYABLE | contributionPayableCode | Social contribution account |
| ADVANCE_RECEIVED | advanceReceivedCode | Advance from customer account |
| ADVANCE_PAID | advancePaidCode | Advance to vendor account |
| CLEARING | clearingCode | Clearing/suspense account |

## Amount Sources

Tax rate is now **dynamic** via `context.taxRate` (defaults to 0.20 if not provided).

| Source | Calculation |
|--------|------------|
| FULL | Full transaction amount |
| TAX_BASE | amount / (1 + taxRate) |
| TAX_AMOUNT | amount × taxRate |
| NET | amount × (1 - taxRate) |
| GROSS | Same as FULL |

## Waterfall Matching (find_posting_rule RPC)

Priority order for matching a posting rule:
1. Exact match: model_code + bank_account_id + currency + partner_type
2. Drop partner_type
3. Drop currency
4. Drop bank_account_id (model_code only)
5. No match → return NULL (caller falls back to hardcoded)

## Files That Create Journal Entries

| File | Engine | Notes |
|------|--------|-------|
| `BankStatements.tsx` | **New** (with legacy fallback) | findPostingRule → resolvePostingRuleToJournalLines |
| `Payroll.tsx` | **Legacy** | posting_rule_catalog lookup |
| `PayrollRunDetail.tsx` | **Legacy** | reads posting_rule_catalog for display |
| `SupplierInvoices.tsx` | **Legacy** | hardcoded 5xxx/2100 |
| `FixedAssets.tsx` | **Legacy** | hardcoded 8100/1290 |
| `FxRevaluation.tsx` | **Legacy** | hardcoded |
| `CashRegister.tsx` | **Legacy** | hardcoded |
| `Deferrals.tsx` | **Legacy** | hardcoded |
| `Kompenzacija.tsx` | **Legacy** | hardcoded |
| `IntercompanyTransactions.tsx` | **Legacy** | hardcoded |
| `Loans.tsx` | **Legacy** | hardcoded (loan disbursement/repayment) |
| `Returns.tsx` | **Legacy** | hardcoded (COGS reversal, credit notes, supplier returns — up to 4 entries) |
| `GoodsReceipts.tsx` | **Legacy** | hardcoded (inventory receipt GL) + `adjust_inventory_stock` |
| `RecurringJournals.tsx` | **Legacy** | template-based |
| `Kalkulacija.tsx` | **RPC** | post_kalkulacija (server-side) |
| `Nivelacija.tsx` | **RPC** | post_nivelacija (server-side) |
| `Invoices.tsx` | **RPC** | process_invoice_post (server-side) |
| `PosTerminal.tsx` | **RPC** | process_pos_sale (server-side) |
| `JournalEntries.tsx` | **RPC** | create_journal_entry_with_lines (direct) |
| `YearEndClosing.tsx` | **RPC** | perform_year_end_closing (server-side) |

## Migration Roadmap

| Source | Current | Target |
|--------|---------|--------|
| Bank Statements | ✅ New engine | Done |
| Supplier Invoices | Hardcoded | New engine (VENDOR_PAYMENT model) |
| Fixed Assets | Hardcoded | New engine (new DEPRECIATION model) |
| Payroll | posting_rule_catalog | New engine (SALARY_PAYMENT + granular models) |
| Cash Register | Hardcoded | New engine (new CASH model) |
| FX Revaluation | Hardcoded | New engine (FX_REVALUATION model) |

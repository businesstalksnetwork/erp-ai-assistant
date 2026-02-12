

# Phase 16: Deep Accounting Integrity & PRD Alignment

## Overview

The PRD mandates deterministic, code-based journal postings, period close enforcement, 3-way matching, payroll auto-posting, production WIP accounting, and enhanced partner data. This phase upgrades the current generic implementations to comply with the Posting Rule Catalog (PRC) and Accounting Integrity Invariants from the PRD.

---

## What Gets Built

### 1. Code-Based Journal Entry Creation (Posting Rule Catalog)

**Current problem**: Supplier Invoice posting uses generic `account_type` lookups (e.g., find any "expense" account). The PRD requires deterministic account code mapping (e.g., code `7000` for COGS, `2100` for AP, `1000` for Cash/Bank).

**Fix**: Refactor `SupplierInvoices.tsx` journal entry creation to use account **codes** instead of types:
- Approve: Debit `7000` (COGS/Expense) + Debit `4700` (Input VAT for tax amount) / Credit `2100` (AP)
- Pay: Debit `2100` (AP) / Credit `1000` (Cash/Bank)

This matches PRC section 14.3 from the PRD.

### 2. Payroll Auto-Posting to General Ledger

**Current problem**: Payroll runs calculate salaries but never create journal entries. PRD PRC section 14.6 requires:
- On "approved": Debit `8000` (General Expenses/Salary cost) / Credit liability accounts for net, taxes, contributions
- On "paid": Debit liability / Credit `1000` (Bank)

**Implementation**: Add journal entry creation when payroll status changes to "approved" and "paid".

### 3. Production WIP Journal Entries

**Current problem**: Production completion only adjusts inventory stock but creates no accounting entries. PRD PRC section 14.5 requires:
- Material issue: Debit WIP / Credit Inventory (Zalihe)
- Completion: Debit Finished Goods Inventory / Credit WIP

**Implementation**: Add a new account code `5000` (WIP) to the seeded chart of accounts. Create journal entries during production order completion alongside inventory movements.

### 4. Fiscal Period Close Enforcement

**Current problem**: Fiscal periods can be opened/closed but nothing prevents posting journal entries to a closed period.

**Implementation**: Before creating any journal entry, check if the entry date falls within a closed fiscal period. Block posting with an error message if it does. This applies to all posting flows (invoice, supplier invoice, payroll, production).

### 5. Enhanced Partner Model

**Current problem**: Partners only have basic fields (name, PIB, address, type). PRD section 4.2 requires credit limits, payment terms, and default currency.

**Implementation**: 
- Add DB columns: `credit_limit`, `payment_terms_days`, `default_currency`, `email`, `phone`, `contact_person`
- Update Partners.tsx form to include these fields
- Display credit limit warnings on invoice/SO creation (future phase)

### 6. Seed Additional Chart of Accounts

Add missing standard accounts needed by the PRC:
- `5000` - Work in Progress (WIP) - asset type
- `5100` - Finished Goods Inventory - asset type

These are needed for production WIP accounting.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/SupplierInvoices.tsx` | Refactor journal creation to use account codes (7000, 4700, 2100, 1000) instead of generic types |
| `src/pages/tenant/Payroll.tsx` | Add journal entry creation on approve/paid status changes |
| `src/pages/tenant/ProductionOrders.tsx` | Add WIP journal entries alongside inventory movements |
| `src/pages/tenant/Partners.tsx` | Add credit_limit, payment_terms_days, default_currency, email, phone, contact_person fields |
| `src/i18n/translations.ts` | Add keys for new partner fields, period close errors, payroll posting messages |
| Database migration | Add partner columns, seed WIP/FG accounts, add period close check function |

---

## Technical Details

### Account Code Lookup Pattern

Replace the current generic type-based lookup:
```text
// BEFORE (wrong - finds any expense account)
accounts.find(a => a.account_type === "expense")

// AFTER (correct - finds specific account by code)
accounts.find(a => a.code === "7000")  // COGS
accounts.find(a => a.code === "2100")  // AP
accounts.find(a => a.code === "1000")  // Cash/Bank
accounts.find(a => a.code === "4700")  // Tax (Input VAT)
```

### Supplier Invoice PRC (section 14.3)

On **approve**:
- Debit `7000` (Expense/COGS): `amount` (net of tax)
- Debit `4700` (Input VAT): `tax_amount`
- Credit `2100` (AP): `total`

On **mark paid**:
- Debit `2100` (AP): `total`
- Credit `1000` (Cash/Bank): `total`

### Payroll PRC (section 14.6)

On **approve** (per payroll run totals):
- Debit `8000` (Salary Expense): `total_gross`
- Credit `2100` (Payable - Net): `total_net`
- Credit `4700` (Tax/Contributions Payable): `total_taxes + total_contributions`

On **paid**:
- Debit `2100` (Payable): `total_net`
- Credit `1000` (Bank): `total_net`

### Production PRC (section 14.5)

On **complete**:
- Journal line 1: Debit `5100` (Finished Goods) / Credit `5000` (WIP) for production output value
- For now, value = quantity * a placeholder unit cost (full costing engine is a future phase)

### Fiscal Period Check

A reusable helper function checks before any journal entry insert:
1. Find fiscal period where `start_date <= entry_date <= end_date`
2. If found and status = "closed" or "locked", throw error "Cannot post to closed period"
3. If found and status = "open", auto-link `fiscal_period_id` on the journal entry

### Partner Schema Changes (Migration)

```text
ALTER TABLE partners ADD COLUMN credit_limit numeric DEFAULT 0;
ALTER TABLE partners ADD COLUMN payment_terms_days integer DEFAULT 30;
ALTER TABLE partners ADD COLUMN default_currency text DEFAULT 'RSD';
ALTER TABLE partners ADD COLUMN email text;
ALTER TABLE partners ADD COLUMN phone text;
ALTER TABLE partners ADD COLUMN contact_person text;
```

### Additional Seeded Accounts (Migration)

Add to `seed_tenant_chart_of_accounts`:
- `5000` - Work in Progress (WIP) / Proizvodnja u toku - asset
- `5100` - Finished Goods / Gotovi proizvodi - asset

### i18n Keys to Add

creditLimit, paymentTermsDays, defaultCurrency, email, phone, contactPerson, periodClosed, cannotPostToClosedPeriod, payrollPosted, payrollPaymentPosted, wipJournalCreated, inputVat


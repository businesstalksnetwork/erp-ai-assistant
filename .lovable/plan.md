

# Hardcoded Dependencies and Broken Connections: Full Audit

## Overview

I found **9 files** with hardcoded GL account codes, **2 modules with no GL posting at all** (despite being financial operations), and **1 engine-level hardcoded VAT rate**. Here is the complete inventory, grouped by severity.

---

## Category 1: Modules With Zero GL Posting (Broken Connections)

These modules create financial records but never generate journal entries, breaking the data flow documented in the dependency matrix.

| File | What It Does | What Is Missing |
|------|-------------|-----------------|
| `CashRegister.tsx` | Inserts cash in/out rows into `cash_register` table | No `createCodeBasedJournalEntry` call. Cash movements never reach the GL. A receipt of 10,000 RSD in cash produces no DR 1000 / CR entry. |
| `IntercompanyTransactions.tsx` | Inserts rows into `intercompany_transactions` | No journal entries created on posting. The "posted" status is a label with no accounting effect. Consolidation elimination has no GL backing. |

**Impact**: Financial reports (Trial Balance, P&L, Balance Sheet) will not reflect cash register activity or intercompany transactions. These are phantom modules from an accounting perspective.

---

## Category 2: Hardcoded Account Codes in Client-Side GL Posting (9 Files)

Each file below constructs journal lines with string literals like `"1200"`, `"2100"`, etc. If a tenant uses a different chart of accounts, all postings break silently (wrong accounts receive entries).

| File | Hardcoded Accounts | Purpose |
|------|--------------------|---------|
| `GoodsReceipts.tsx` | 1200, 2100 | Inventory DR / AP CR on goods receipt |
| `SupplierInvoices.tsx` | 7000, 4700, 2100, 1000 | COGS, Input VAT, AP, Bank on invoice approval and payment |
| `Returns.tsx` | 1200, 7000, 4000, 2100, 6000, 2040, 4320 | COGS reversal, revenue reversal, AP clearing, credit notes (4 separate entry types) |
| `Loans.tsx` | 4200, 5330, 2431, 2040, 6020 | Loan principal, interest expense/income, bank account |
| `Kompenzacija.tsx` | 4350, 2040 | AP/AR offset |
| `FixedAssets.tsx` | 0121, 0120, 2431, 6072, 5073, 5310 | Depreciation, disposal gain/loss, accumulated depreciation |
| `FxRevaluation.tsx` | 2040, 4350, 6072, 5072 | FX gains/losses on AR/AP |
| `Deferrals.tsx` | 4600, 6010, 5400, 1500 | Deferred revenue/expense recognition |
| `BankStatements.tsx` | 2410, 2040, 4350 | Legacy fallback when no posting rule matches |

**Total**: **31 unique hardcoded account codes** across 9 files.

---

## Category 3: Hardcoded VAT Rate in Posting Rule Engine

In `src/lib/postingRuleEngine.ts`, both `simulatePosting` (line 58) and `resolvePostingRuleToJournalLines` (line 176) use:

```
case "TAX_AMOUNT": lineAmount = amount * 0.2; // 20% VAT default
case "TAX_BASE": lineAmount = amount / 1.2;
case "NET": lineAmount = amount * 0.8;
```

Serbia has **three** VAT rates: 20%, 10%, and 0%. The 10% rate applies to food, medicine, newspapers, etc. Any posting rule using `TAX_AMOUNT` or `TAX_BASE` for a 10% item will calculate the wrong amount. The tax rate should come from the transaction context (the `tax_rates` table already exists in the database).

---

## Category 4: Payroll Legacy Engine (Partially Connected)

`Payroll.tsx` uses the old `posting_rule_catalog` table (flat debit/credit pairs) rather than the new `posting_rules` + `posting_rule_lines` engine. There is a TODO comment at line 107-108 acknowledging this. The `payroll_pt_gl_overrides` table provides per-payment-type GL overrides, which is a workaround for the lack of proper posting rules.

---

## Proposed Fix: Migrate All 11 Modules to Posting Rules Engine

The posting rules engine (`posting_rules` + `posting_rule_lines` + `find_posting_rule` RPC) already works for Bank Statements. The fix is to extend it to all other modules.

### Step 1: Define New Payment Model Codes

Add these model codes to `PAYMENT_MODEL_KEYS` in `postingRuleEngine.ts` and seed them via `seed_default_posting_rules`:

| Model Code | For Module |
|------------|------------|
| `GOODS_RECEIPT` | GoodsReceipts.tsx |
| `SUPPLIER_INVOICE_POST` | SupplierInvoices.tsx (approval) |
| `SUPPLIER_INVOICE_PAYMENT` | SupplierInvoices.tsx (payment) |
| `CUSTOMER_RETURN_RESTOCK` | Returns.tsx (COGS reversal) |
| `CUSTOMER_RETURN_CREDIT` | Returns.tsx (credit note) |
| `SUPPLIER_RETURN` | Returns.tsx (supplier return) |
| `CREDIT_NOTE_ISSUED` | Returns.tsx (credit note issuance) |
| `LOAN_PAYMENT_PAYABLE` | Loans.tsx (payable) |
| `LOAN_PAYMENT_RECEIVABLE` | Loans.tsx (receivable) |
| `COMPENSATION` | Kompenzacija.tsx |
| `ASSET_DEPRECIATION` | FixedAssets.tsx |
| `ASSET_DISPOSAL` | FixedAssets.tsx |
| `FX_GAIN` | FxRevaluation.tsx |
| `FX_LOSS` | FxRevaluation.tsx |
| `DEFERRAL_REVENUE` | Deferrals.tsx |
| `DEFERRAL_EXPENSE` | Deferrals.tsx |
| `CASH_IN` | CashRegister.tsx |
| `CASH_OUT` | CashRegister.tsx |
| `INTERCOMPANY_POST` | IntercompanyTransactions.tsx |
| `PAYROLL_NET` | Payroll.tsx (migrate from legacy) |
| `PAYROLL_TAX` | Payroll.tsx (migrate from legacy) |

### Step 2: Database Migration

Create a migration that:
1. Adds a `payment_models` seed for each new model code
2. Creates default `posting_rules` + `posting_rule_lines` for each model with the currently-hardcoded accounts as FIXED defaults
3. Updates `seed_default_posting_rules` RPC to include all new models

### Step 3: Refactor Each File

For each of the 11 files, replace the hardcoded pattern:
```typescript
// BEFORE (hardcoded)
await createCodeBasedJournalEntry({
  lines: [
    { accountCode: "1200", debit: amount, credit: 0, ... },
    { accountCode: "2100", debit: 0, credit: amount, ... },
  ],
});
```

With the engine pattern (already proven in BankStatements.tsx):
```typescript
// AFTER (configurable)
const rule = await findPostingRule(tenantId, "GOODS_RECEIPT");
let journalLines;
if (rule) {
  journalLines = await resolvePostingRuleToJournalLines(
    tenantId, rule.lines, amount, dynamicContext
  );
} else {
  // Fallback to hardcoded (temporary, log warning)
  journalLines = [
    { accountCode: "1200", debit: amount, credit: 0, ... },
    { accountCode: "2100", debit: 0, credit: amount, ... },
  ];
}
await createCodeBasedJournalEntry({ ..., lines: journalLines });
```

### Step 4: Fix Hardcoded VAT in Engine

Update `resolvePostingRuleToJournalLines` to accept a `taxRate` parameter in the context:

```typescript
interface DynamicContext {
  // ... existing fields
  taxRate?: number; // e.g. 0.20 or 0.10
}
```

Replace `amount * 0.2` with `amount * (context.taxRate ?? 0.2)` and `amount / 1.2` with `amount / (1 + (context.taxRate ?? 0.2))`.

### Step 5: Add GL Posting to CashRegister and IntercompanyTransactions

These two modules need `createCodeBasedJournalEntry` calls added (via posting rules), triggered when status transitions to "posted" or on record creation.

---

## Summary of Work

| Item | Files Affected | Complexity |
|------|---------------|------------|
| New payment model codes + seed migration | DB migration + `postingRuleEngine.ts` | Medium |
| Refactor 9 hardcoded files to use engine | 9 `.tsx` files | Medium (repetitive) |
| Add GL posting to CashRegister | `CashRegister.tsx` | Low |
| Add GL posting to IntercompanyTransactions | `IntercompanyTransactions.tsx` | Low |
| Fix hardcoded VAT rate in engine | `postingRuleEngine.ts` | Low |
| Migrate Payroll from legacy catalog | `Payroll.tsx`, `PayrollRunDetail.tsx` | High |

This is a large refactor. I recommend implementing it in phases: first the VAT fix and the two missing GL connections (CashRegister + Intercompany), then migrating the 9 hardcoded files one by one, and finally the Payroll legacy migration.




# GL Posting Rules -- Full PRD Implementation

## Summary

The PRD specifies a sophisticated GL posting rules engine replacing the current flat `posting_rule_catalog` table (simple rule_code → debit/credit mapping) with a 4-table architecture supporting multi-line posting rules, payment model classification, bank account → GL account mapping, and a waterfall selection algorithm. This is compliant with Serbian Accounting Law (73/2019) and the Chart of Accounts regulation (89/2020).

---

## Current State

- **`posting_rule_catalog`**: Flat table with `rule_code`, `debit_account_code`, `credit_account_code` -- 17 seeded rules (POS, invoicing, payroll)
- **`chart_of_accounts`**: Exists with `code`, `name`, `account_type`, `is_active`, `level`
- **`bank_accounts`**: Exists with `gl_account_id` FK to chart_of_accounts -- already supports the bank→GL mapping concept
- **No tables exist**: `payment_models`, `posting_rules` (multi-line), `posting_rule_lines`, `account_mappings`
- **UI**: Simple table editor for debit/credit codes grouped by POS/invoicing/payroll

## Architecture

```text
┌──────────────────┐     ┌──────────────────────┐
│  payment_models  │────▶│    posting_rules      │
│  (CUSTOMER_PAY,  │     │  (tenant, model,      │
│   VENDOR_PAY,    │     │   bank_account?,      │
│   SALARY...)     │     │   currency?, priority)│
└──────────────────┘     └──────────┬───────────┘
                                   │ 1:N
                         ┌─────────▼───────────┐
                         │ posting_rule_lines   │
                         │ (side, account_id,   │
                         │  account_source,     │
                         │  amount_source,      │
                         │  dynamic_source)     │
                         └─────────────────────┘

┌──────────────────┐     ┌──────────────────────┐
│  bank_accounts   │────▶│  account_mappings     │
│  (existing)      │     │  (bank→GL override)   │
└──────────────────┘     └──────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema (Migration)

Create 3 new tables + 1 RPC function:

**Table: `payment_models`** -- System-defined payment transaction types
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| code | text UNIQUE | e.g. CUSTOMER_PAYMENT, VENDOR_PAYMENT |
| name_en | text | English name |
| name_sr | text | Serbian name |
| direction | text | IN, OUT, INTERNAL, NONE |
| affects_bank | boolean | Whether it hits a bank account |
| requires_invoice | boolean | Must be linked to a document |
| allows_partial | boolean | Partial matching allowed |
| is_system | boolean | Non-deletable system models |
| description | text | |

Seeded with 14 models from PRD: CUSTOMER_PAYMENT, VENDOR_PAYMENT, ADVANCE_RECEIVED, ADVANCE_PAID, SALARY_PAYMENT, TAX_PAYMENT, VAT_PAYMENT, VAT_REFUND, BANK_FEE, INTER_ACCOUNT_TRANSFER, FX_REVALUATION, INTERNAL_COMPENSATION, CUSTOMER_REFUND, VENDOR_REFUND.

**Table: `posting_rules`** -- Tenant-specific rules linking payment models to GL entries
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| payment_model_id | UUID FK | Which payment model |
| bank_account_id | UUID FK nullable | Specific bank account (null = all) |
| currency | char(3) nullable | Specific currency (null = all) |
| partner_type | text nullable | CUSTOMER, VENDOR, EMPLOYEE, etc. |
| name | text | Rule name |
| description | text | |
| is_default | boolean | Fallback rule for this model |
| priority | integer | Higher = more specific |
| auto_post | boolean | Auto-post without approval |
| require_approval | boolean | |
| valid_from | date | |
| valid_to | date nullable | |
| is_active | boolean | |

**Table: `posting_rule_lines`** -- Individual debit/credit lines within a rule
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| posting_rule_id | UUID FK | |
| line_number | integer | Sort order |
| side | text | DEBIT or CREDIT |
| account_source | text | FIXED or DYNAMIC |
| account_id | UUID FK nullable | GL account if FIXED |
| dynamic_source | text nullable | BANK_ACCOUNT, PARTNER_RECEIVABLE, etc. |
| amount_source | text | FULL, TAX_BASE, TAX_AMOUNT, NET, GROSS |
| amount_factor | decimal nullable | Multiplier (e.g. 0.2 for 20% VAT) |
| description_template | text | Template with {invoice_number} etc. |
| is_tax_line | boolean | PDV tracking flag |

**Table: `account_mappings`** -- Bank account → GL account overrides
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| bank_account_id | UUID FK | |
| gl_account_id | UUID FK | |
| mapping_type | text | PRIMARY, CLEARING, FEE |
| valid_from | date | |
| valid_to | date nullable | |

**RPC: `find_posting_rule`** -- Waterfall selection algorithm
- Input: tenant_id, payment_model_code, bank_account_id?, currency?, partner_type?
- Searches through 6 priority levels (most specific → global default)
- Returns the first matching posting_rule with its lines

### Phase 2: Seed Default Serbian Rules

Seed 14 payment models and ~14 default posting rules with lines matching the PRD's standard rules (sections 4.1--4.10):
- CUSTOMER_PAYMENT: D:241(dynamic:bank) / C:204(dynamic:partner_receivable)
- VENDOR_PAYMENT: D:430(dynamic:partner_payable) / C:241(dynamic:bank)
- ADVANCE_RECEIVED: D:241 / C:441 / C:470(tax_amount)
- SALARY_PAYMENT: D:462 / C:241
- TAX_PAYMENT: D:463 / D:464 / C:241
- etc.

### Phase 3: Enhanced UI -- PostingRules Page Rebuild

Replace the current flat table with:

1. **Payment Model Tabs/Accordion** -- Group rules by payment model (Customer Payments, Vendor Payments, Payroll, etc.)
2. **T-Account Visual Display** -- Show each rule as a T-account with debit lines on the left, credit lines on the right
3. **Rule Creation Wizard** (3-step dialog):
   - Step 1: Select payment model, optional bank account filter, currency, partner type, validity period
   - Step 2: T-account editor -- add debit/credit lines with account selector (FIXED from CoA dropdown or DYNAMIC source)
   - Step 3: Validation preview (D=C balance check)
4. **Bank Account Mapping Section** -- Show which bank accounts are mapped to which GL analytics accounts
5. **"Test Rule" Button** -- Simulate a posting with a test amount without creating actual JE
6. **Coverage Warning** -- Alert if any payment model has no rules defined

### Phase 4: Backward Compatibility

- Keep the existing `posting_rule_catalog` table operational during transition
- Payroll GL posting (`Payroll.tsx`, `PayrollRunDetail.tsx`) continues using `posting_rule_catalog` until the new engine is integrated
- Add a migration path: existing rules can be migrated to the new structure

---

## Files Changed

| File | Changes |
|------|---------|
| `supabase/migrations/NEW_payment_models.sql` | Create `payment_models`, `posting_rules`, `posting_rule_lines`, `account_mappings` tables with RLS, seed 14 payment models + default rules, create `find_posting_rule` RPC |
| `src/pages/tenant/PostingRules.tsx` | Complete rebuild: payment model grouping, T-account display, 3-step wizard, bank mapping section, test simulation, coverage warnings |
| `src/i18n/translations.ts` | Add ~50 new keys: payment model names, rule editor labels, T-account terms, wizard steps, validation messages |
| `src/lib/postingRuleEngine.ts` | New file: client-side helper to call `find_posting_rule` RPC and resolve dynamic accounts |

## Technical Details

### Waterfall Selection SQL (simplified)

```sql
CREATE FUNCTION find_posting_rule(p_tenant_id uuid, p_model_code text, 
  p_bank_account_id uuid DEFAULT NULL, p_currency text DEFAULT NULL, 
  p_partner_type text DEFAULT NULL)
RETURNS TABLE(rule_id uuid, rule_name text, lines jsonb)
AS $$
  SELECT pr.id, pr.name, jsonb_agg(...)
  FROM posting_rules pr
  JOIN payment_models pm ON pr.payment_model_id = pm.id
  JOIN posting_rule_lines prl ON prl.posting_rule_id = pr.id
  WHERE pr.tenant_id = p_tenant_id
    AND pm.code = p_model_code
    AND pr.is_active = true
    AND CURRENT_DATE BETWEEN pr.valid_from AND COALESCE(pr.valid_to, '9999-12-31')
  ORDER BY pr.priority DESC
  LIMIT 1;
$$
```

### T-Account Visual Component

Each rule renders as:
```text
┌─────────────────────────────────────┐
│  Rule: Customer Payment (RSD)       │
├──────────────┬──────────────────────┤
│   DEBIT      │   CREDIT             │
├──────────────┼──────────────────────┤
│ 241 Bank     │ 204 Receivable       │
│ [DYNAMIC]    │ [DYNAMIC]            │
│ FULL amount  │ FULL amount          │
└──────────────┴──────────────────────┘
```

### Validation Rules (enforced in wizard Step 3)

1. At least 1 DEBIT and 1 CREDIT line
2. Sum of amount_factors on DEBIT side must equal CREDIT side (for FULL amounts, factor=1.0)
3. FIXED accounts must have `is_active=true` in chart_of_accounts
4. DYNAMIC lines must specify `dynamic_source`
5. No duplicate rule: same model + bank + currency + partner_type + overlapping dates




# Critical Accounting & POS Compliance Fix -- Serbian Pravilnik 89/2020

This plan addresses the 25 critical/high bugs identified in the audit, prioritized by legal compliance impact. The PRD v2.0 document has been analyzed in full.

---

## Summary of Critical Issues Found

| # | Issue | Severity | Current State | Required State |
|---|-------|----------|--------------|----------------|
| 1 | Chart of Accounts uses Anglo-Saxon codes (1000/1200/2100) | CRITICAL | Codes like 1000, 1200, 6000, 8000 | Serbian classes 0-9 per Pravilnik 89/2020 |
| 2 | POS creates no journal entries | CRITICAL | Only pos_transactions row | Must create Revenue (6010), PDV (2470), COGS (5xxx) entries |
| 3 | POS creates no inventory movements | CRITICAL | Stock unchanged after sale | Must deduct from store warehouse |
| 4 | No maloprodaja accounting (1320/1329) | CRITICAL | No retail inventory concepts | Need Roba u maloprodaji, Razlika u ceni, Kalkulacija, Nivelacija |
| 5 | No COGS posting on any sale | CRITICAL | Revenue posted, cost never recognized | D: 5010 Nabavna vrednost, P: 1320 Roba |
| 6 | Payroll nontaxable = 25,000 RSD | CRITICAL | Hardcoded 25,000 | Must be 34,221 RSD for 2026 |
| 7 | Payroll contributions lumped into 1 line | HIGH | Single pension/health/unemployment | 8 separate lines per Serbian law |
| 8 | Invoice posting uses wrong accounts | HIGH | D:1200 P:6000 | D:2040 Kupci, P:6010 Prihod, D:2470 PDV |
| 9 | Payroll journal uses wrong accounts | HIGH | D:8000 P:2100 P:4700 | D:5200 Bruto zarade, P:4500 Obaveze za neto, P:4510 Porez, P:4520-4570 doprinosi |
| 10 | All edge functions JWT disabled | HIGH | verify_jwt = false, no code-level check | Add getClaims() validation |
| 11 | Missing accounts for FX revaluation | HIGH | No 5072/6072 accounts | Required for kursne razlike |
| 12 | Missing accounts for Kompenzacija | HIGH | No 2040/4350 accounts | Required for mutual offset |

---

## Phase 1: Serbian Chart of Accounts Overhaul (Database Migration)

Replace the entire seed function with proper Serbian Kontni Plan codes per Pravilnik 89/2020.

### New Account Structure (Classes 0-9)

```text
Class 0 - Fixed Assets:
  0100 Zemljiste (Land)
  0120 Masine i oprema (Machinery & Equipment)
  0121 Akumulirana amortizacija (Accumulated Depreciation)
  0200 Gradevinski objekti (Buildings)
  0300 Nematerijalna ulaganja (Intangible Assets)

Class 1 - Inventory (Zalihe):
  1100 Sirovine i materijal (Raw Materials)
  1200 Gotova roba (Finished Goods)
  1300 Roba (Merchandise - veleprodaja)
  1320 Roba u maloprodaji (Retail Merchandise - at retail price)
  1329 Razlika u ceni (Price Difference / Retail Markup)
  1500 Unapred placeni troskovi (Prepaid Expenses)

Class 2 - Receivables & Cash:
  2040 Kupci (Accounts Receivable / Customers)
  2090 Ispravka vrednosti kupaca (Bad Debt Allowance)
  2430 Gotovina (Cash)
  2431 Tekuci racun (Bank Account)
  2470 PDV na izlaznim fakturama (Output VAT)
  2480 PDV na ulaznim fakturama (Input VAT)

Class 3 - Equity:
  3000 Osnovni kapital (Share Capital)
  3300 Revalorizacione rezerve (Revaluation Reserve)
  3400 Nerasporedjena dobit (Retained Earnings)
  3500 Gubitak (Loss)

Class 4 - Liabilities:
  4200 Dugorocne obaveze (Long-term Debt)
  4350 Dobavljaci (Accounts Payable / Suppliers)
  4500 Obaveze za neto zarade (Net Salary Payable)
  4510 Obaveze za porez na zarade (Income Tax Payable)
  4520 Obaveze za PIO zaposleni (Pension - Employee)
  4521 Obaveze za PIO poslodavac (Pension - Employer)
  4530 Obaveze za zdravstvo zaposleni (Health - Employee)
  4531 Obaveze za zdravstvo poslodavac (Health - Employer)
  4540 Obaveze za nezaposlenost zaposleni (Unemployment - Employee)
  4541 Obaveze za nezaposlenost poslodavac (Unemployment - Employer)
  4600 Prihodi buducih perioda (Deferred Revenue)

Class 5 - Expenses:
  5010 Nabavna vrednost prodate robe (COGS)
  5072 Gubitak na kursnim razlikama (FX Loss)
  5073 Gubitak na otpisu (Write-off Loss)
  5074 Gubitak na donaciji (Donation Loss)
  5200 Bruto zarade i naknade (Gross Salary Expense)
  5310 Amortizacija (Depreciation Expense)
  5330 Kamatni rashodi (Interest Expense)
  5400 Usluge (Services Expense)
  5530 Materijal (Materials Expense)

Class 6 - Revenue:
  6010 Prihod od prodaje robe (Sales Revenue)
  6072 Dobitak na kursnim razlikama (FX Gain)

Class 7 - Year-end Closing:
  7100 Zakljucak prihoda (Revenue Closing)
  7200 Zakljucak rashoda (Expense Closing)

Class 8 - Financial Items (kept for backward compat, mapped):
  (legacy 8000/8100/8200/8300 mapped to proper 5xxx accounts)

Class 9 - Tax:
  9100 Porez na dobit (Income Tax Expense)
```

### Migration Strategy

The migration will:
1. Create a mapping table from old codes to new codes
2. Insert all new Serbian-compliant accounts for all existing tenants
3. Update all references in journal_lines to point to new account IDs
4. Update the seed function for new tenants
5. Mark old Anglo-Saxon accounts as inactive (not delete, for audit trail)
6. Update all RPC functions that reference account codes

---

## Phase 2: Fix Invoice Posting (create_journal_from_invoice)

### Current (Wrong)
- D: 1200 (AR) / P: 6000 (Revenue) / P: 4700 (VAT)

### Correct per PRD PRC 6.1
- D: 2040 Kupci (full amount incl. PDV)
- P: 6010 Prihod od prodaje (subtotal)
- P: 2470 PDV na izlaznim fakturama (tax amount)

### Payment Journal (mark as paid)
- D: 2430 Gotovina or 2431 Tekuci racun
- P: 2040 Kupci

### Add COGS Posting
When invoice has product lines with inventory, also post:
- D: 5010 Nabavna vrednost prodate robe (cost of items)
- P: 1300 Roba (or 1200 Gotova roba)

Cost is determined from `inventory_cost_layers` (FIFO) or product `default_purchase_price`.

---

## Phase 3: POS Transaction Accounting Integration

### Current State
`PosTerminal.tsx` completeSale creates only a `pos_transactions` row. No GL, no inventory.

### Required Changes

**New RPC: `process_pos_sale`**

Called after pos_transaction insert, this function will:

1. **Journal Entry - Revenue Recognition**:
   - Cash sale: D: 2430 Gotovina, P: 6010 Prihod, P: 2470 PDV
   - Card sale: D: 2431 Tekuci racun, P: 6010 Prihod, P: 2470 PDV

2. **Journal Entry - COGS**:
   - D: 5010 Nabavna vrednost prodate robe
   - P: 1320 Roba u maloprodaji (for retail locations)

3. **Inventory Deduction**:
   - Call `adjust_inventory_stock` for each item, deducting from the POS location's warehouse

4. **Update pos_transaction** with `journal_entry_id`

### PosTerminal.tsx Changes

After successful `pos_transactions` insert, call:
```sql
SELECT process_pos_sale(transaction_id, tenant_id);
```

---

## Phase 4: Maloprodaja (Retail) Accounting

### New Concepts Required

**Konto 1320 - Roba u maloprodaji**: Goods in retail stores valued at RETAIL price (including PDV markup). This is NOT the purchase cost -- it's the selling price stored as inventory value.

**Konto 1329 - Razlika u ceni (RuC)**: Contra-account to 1320. Stores the difference between retail price and purchase cost. Always a credit balance. When goods are received into retail: 1320 is debited at retail price, 1329 is credited for the markup portion, and 1300/1200 is credited for the cost.

**Kalkulacija (Price Calculation)**: When goods move from veleprodajni magacin (wholesale warehouse) to prodajni magacin (retail store), a kalkulacija document is created that:
- Records purchase cost (nabavna cena)
- Adds markup (marza)
- Adds PDV
- Calculates retail price (maloprodajna cena sa PDV)
- Creates journal: D: 1320 (retail price), P: 1329 (markup + PDV), P: 1300 (cost)

**Nivelacija (Price Adjustment)**: When retail prices change:
- If price increases: D: 1320 (increase), P: 1329 (increase in RuC)
- If price decreases: D: 1329 (decrease RuC), P: 1320 (decrease)

### Integration with Internal Supply Chain

When `confirm_internal_receipt` fires (store confirms goods from warehouse):
1. Current: adds stock to destination warehouse
2. New: ALSO creates kalkulacija journal entry:
   - D: 1320 Roba u maloprodaji (at retail price)
   - P: 1329 Razlika u ceni (markup portion)
   - P: 1300 Roba (at purchase cost)

When POS sale occurs:
1. D: 5010 COGS (at cost -- derived from 1320 - 1329)
2. P: 1320 Roba u maloprodaji (at retail price)
3. D: 1329 Razlika u ceni (reverse the markup)

### New Page: Kalkulacija

A page to manage kalkulacija documents showing:
- Product, purchase price, markup %, PDV rate, retail price
- Link to internal transfer / goods receipt
- Journal entry preview before posting

### New Page: Nivelacija

A page to manage price changes:
- Select products at a retail location
- Enter new retail price
- System calculates adjustment to 1320/1329
- Posts journal entry on confirmation

---

## Phase 5: Payroll Calculation Fix

### Current Issues in `calculate_payroll_for_run`

1. **v_nontaxable = 25,000** -- Must be **34,221 RSD** (2026 value per Zakon o porezu na dohodak)
2. **Tax formula wrong**: Currently deducts contributions before nontaxable. Correct: taxable = gross - nontaxable (contributions are NOT deducted from tax base in Serbia)
3. **Contributions lumped**: Only tracks pension/health/unemployment. Must track 8 separate lines.

### Correct 2026 Serbian Payroll Calculation

```text
Given: Bruto zarada (gross salary)

Employee contributions (from gross):
  PIO zaposleni:        14.00% of gross -> konto 4520
  Zdravstvo zaposleni:   5.15% of gross -> konto 4530
  Nezaposlenost zaposl:  0.75% of gross -> konto 4540

Taxable base: gross - 34,221 (neoporezivi iznos)
Porez na zarade: 10% of taxable base -> konto 4510

Net = gross - PIO_zap - zdravstvo_zap - nezaposlenost_zap - porez

Employer contributions (on top of gross):
  PIO poslodavac:       11.50% of gross -> konto 4521
  Zdravstvo poslodavac:  5.15% of gross -> konto 4531

Total cost = gross + PIO_poslodavac + zdravstvo_poslodavac
```

Note: Unemployment employer contribution was abolished. Only 6 contribution lines (not 8 -- correcting the user's count: nezaposlenost poslodavac no longer exists in 2026).

### Payroll Journal Entry Fix

**On Approve (accrual):**
- D: 5200 Bruto zarade (full gross)
- P: 4500 Obaveze za neto (net amount)
- P: 4510 Porez na zarade (income tax)
- P: 4520 PIO zaposleni (pension employee)
- P: 4530 Zdravstvo zaposleni (health employee)
- P: 4540 Nezaposlenost zaposleni (unemployment employee)

**Employer cost entry:**
- D: 5200 Bruto zarade - doprinosi poslodavca
- P: 4521 PIO poslodavac
- P: 4531 Zdravstvo poslodavac

**On Payment:**
- D: 4500 Obaveze za neto / P: 2431 Tekuci racun (pay employees)
- D: 4510+4520+4530+4540+4521+4531 / P: 2431 (pay state)

### Payroll UI Update (Payroll.tsx)

Update the payroll items table to show all 6 contribution lines separately instead of the current 3 columns.

---

## Phase 6: Edge Function JWT Security

Add `getClaims()` validation to these edge functions:
- `create-tenant` (admin only)
- `fiscalize-receipt` (tenant user)
- `sef-submit` (tenant user)
- `generate-pdf` (tenant user)
- `ai-assistant` (authenticated user)
- `ai-insights` (authenticated user)
- `create-notification` (authenticated user)

Keep `verify_jwt = false` in config.toml (signing-keys approach) but add code-level JWT validation.

Public endpoints (no JWT needed but add signature/secret validation):
- `nbs-exchange-rates` (cron/public data)
- `web-sync` (webhook)
- `web-order-import` (webhook)
- `company-lookup` (public utility)
- `process-module-event` (internal trigger)

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| Migration SQL | Complete chart of accounts overhaul, process_pos_sale RPC, payroll fix |
| `src/pages/tenant/Kalkulacija.tsx` | Retail price calculation management |
| `src/pages/tenant/Nivelacija.tsx` | Retail price adjustment management |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/tenant/PosTerminal.tsx` | Call process_pos_sale after transaction |
| `src/pages/tenant/Payroll.tsx` | Show 6 contribution columns, update journal posting accounts |
| `src/pages/tenant/Invoices.tsx` | Update account references in posting |
| `src/lib/journalUtils.ts` | Update all account code references |
| `src/layouts/TenantLayout.tsx` | Add Kalkulacija/Nivelacija to nav |
| `src/App.tsx` | Add routes |
| `src/i18n/translations.ts` | Add Serbian accounting terms |
| `supabase/functions/create-tenant/index.ts` | Add getClaims() |
| `supabase/functions/fiscalize-receipt/index.ts` | Add getClaims() |
| `supabase/functions/sef-submit/index.ts` | Add getClaims() |
| `supabase/functions/generate-pdf/index.ts` | Add getClaims() |
| `supabase/functions/ai-assistant/index.ts` | Add getClaims() |
| `supabase/functions/ai-insights/index.ts` | Add getClaims() |
| `supabase/functions/create-notification/index.ts` | Add getClaims() |

### Implementation Order
1. Database migration (accounts + RPCs) -- foundation for everything
2. Invoice posting fix (uses new accounts)
3. POS accounting integration (uses new accounts + COGS)
4. Maloprodaja pages (Kalkulacija, Nivelacija)
5. Payroll calculation fix
6. Edge function security
7. Translations + navigation


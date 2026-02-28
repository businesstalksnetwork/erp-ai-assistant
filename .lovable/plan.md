

# Phases 6, 7, and 8 Implementation Plan

## Scope Summary
- **Phase 6** (P6-01 to P6-15): Serbian law compliance gaps — tax loss carryforward, thin capitalization, quarterly CIT, VAT pro-rata, capital goods adjustment, special VAT schemes, deferred tax, non-deductible expenses, investment/R&D credits, CROSO integration, RFZO tracking, foreign per diem, amortization plan, intercompany eliminations
- **Phase 7** (P7-01 to P7-09): Integration & API fixes — retire legacy SEF, SEF webhooks, ePorezi PP-PDV submission, APR electronic filing, NBS cron, eBolovanje JMBG checksum, generate-apr-xml auth fix, Z-Report, PFR void receipt
- **Phase 8** (P8-01 to P8-10): Polish — BOM weighted average cost, loyalty net-of-VAT, POS cash reconciliation, bulk invoice confirmation dialog, production order sequence, T-account GL view, prior year comparison, Serbian month names, account class validation, CIT/PB-1 merge

---

## Implementation Steps

### Phase 6 — Serbian Law Compliance (14 tasks across ~8 files + new pages)

**P6-01: Tax Loss Carryforward (ZPDP Art. 32-38)**
- Create new page `src/pages/tenant/TaxLossCarryforward.tsx` with a 5-year tracking table (year, loss amount, used, remaining, expiry)
- Add route + sidebar link under Accounting > Reports
- Integrate into PB-1 auto-population (PoreskiBilans.tsx — populate line items from carryforward data)

**P6-02: Thin Capitalization (ZPDP Art. 61-63)**
- Create `src/pages/tenant/ThinCapitalization.tsx` — input related-party debt, equity, interest; compute 4:1 ratio and non-deductible interest
- Add route under Accounting > Reports

**P6-03: Quarterly CIT Advance Payments**
- Create `src/pages/tenant/CitAdvancePayments.tsx` — calculator based on prior year tax, payment schedule with due dates and status tracking

**P6-04: VAT Pro-Rata (ZoPDV Art. 31)**
- Create `src/pages/tenant/VatProRata.tsx` — annual coefficient calculator (taxable/total revenue), apply to mixed-use input VAT
- SQL migration for `vat_prorata_coefficients` table

**P6-05: Capital Goods VAT Adjustment (ZoPDV Art. 32)**
- Create `src/pages/tenant/CapitalGoodsVatRegister.tsx` — 5yr/10yr monitoring with annual adjustment entries

**P6-06: VAT Special Schemes**
- Add margin scheme, tourism scheme, agricultural flat-rate tabs to existing VAT/PDV module or new page

**P6-07: Deferred Tax (IAS 12)**
- Create `src/pages/tenant/DeferredTax.tsx` — compute deferred tax asset/liability from tax vs accounting depreciation diff

**P6-08: Non-Deductible Expense Auto-Calc (ZPDP Art. 15-16)**
- Add auto-calculation logic to PoreskiBilans.tsx: representation 0.5% revenue cap, advertising 10% revenue cap
- Fetch GL data for expense accounts 5500/5510 and revenue totals

**P6-09 & P6-10: Investment + R&D Tax Credits**
- Add fields/sections to PoreskiBilans.tsx for 25% investment credit (Art. 50a) and 100%+100% R&D credit (Art. 40a)

**P6-11: CROSO M-1/M-2 Integration**
- Create edge function `supabase/functions/generate-croso-xml/index.ts` for M-1 (hire) / M-2 (termination) forms
- Add UI trigger in HR Employees page

**P6-12: RFZO Reimbursement Tracking**
- Extend EBolovanje.tsx with reimbursement tracking tab for sick leave >30 days

**P6-13: Foreign Travel Per Diem Rates**
- Create `src/data/foreignPerDiemRates.ts` with country-specific rates per Uredba
- Integrate into TravelOrderForm.tsx for international trips

**P6-14: Amortization Plan Per Asset**
- Add printable multi-year depreciation schedule view to FixedAssets detail

**P6-15: Intercompany Eliminations**
- Create `src/pages/tenant/IntercompanyEliminations.tsx` — elimination journal entries for consolidated reporting (IFRS 10)

### Phase 7 — Integration & API Fixes (9 tasks)

**P7-01: Retire Legacy SEF Functions**
- Update all client-side callers of `sef-send-invoice`, `sef-accept-reject-invoice`, `sef-fetch-purchase-invoices`, `sef-cancel-sales-invoice` to use `sef-submit` family instead
- Mark legacy functions as deprecated with console warnings

**P7-02: SEF Webhook Support**
- Create `supabase/functions/sef-webhook/index.ts` — receive push notifications from SEF for invoice status changes
- Update invoice status in DB on webhook receipt

**P7-03: ePorezi Direct PP-PDV Submission**
- Extend `generate-pppdv-xml` to optionally submit directly to ePorezi API
- Fix namespace: root element → `ObrazacPPPDV`, namespace → `urn:poreskauprava.gov.rs:pppdv`

**P7-04: APR Electronic Submission**
- Extend `generate-apr-xml` to support direct APR API filing (if API available), or prepare proper upload format

**P7-05: NBS Exchange Rate Auto-Fetch Cron**
- Create `supabase/functions/nbs-daily-cron/index.ts` — daily scheduled fetch
- Add cron config to `supabase/config.toml`

**P7-06: eBolovanje JMBG Mod-11 Checksum**
- Update `ebolovanje-submit/index.ts` `validateJmbg` function:
```
function validateJmbg(jmbg: string): boolean {
  if (!/^\d{13}$/.test(jmbg)) return false;
  const d = jmbg.split("").map(Number);
  const sum = 7*(d[0]+d[6]) + 6*(d[1]+d[7]) + 5*(d[2]+d[8])
            + 4*(d[3]+d[9]) + 3*(d[4]+d[10]) + 2*(d[5]+d[11]);
  let ctrl = 11 - (sum % 11);
  if (ctrl > 9) ctrl = 0;
  return ctrl === d[12];
}
```

**P7-07: Fix generate-apr-xml Authorization**
- Change `tenant_users` / `is_active` check to `tenant_members` / `status = 'active'`
- Same fix in `generate-pppdv-xml`

**P7-08: Z-Report as Dedicated PFR Operation**
- Add Z-report generation to POS daily report flow via `fiscalize-receipt` extension or new edge function

**P7-09: PFR Void Receipt Support**
- Add void receipt workflow to POS — same-day cancellation with refund type `2` (Voided)

### Phase 8 — Polish (10 tasks)

**P8-01: BOM Weighted Average Cost**
- Update BOM cost display to use weighted average from inventory cost layers instead of `products.purchase_price`

**P8-02: Loyalty Point Accrual — Net (ex-VAT)**
- Update `accrue_loyalty_points` call sites to pass net amount (total / 1.2 for 20% VAT)

**P8-03: POS Session Cash Reconciliation**
- Add cash counting UI to POS session close flow with expected vs actual variance

**P8-04: Bulk Invoice Action Confirmation Dialog**
- Add `AlertDialog` confirmation before bulk mark-as-paid/delete in Invoices.tsx

**P8-05: Production Order Number Sequence**
- Replace `MAX+1` with PostgreSQL sequence or atomic RPC (same pattern as journal entries)

**P8-06: T-Account View in General Ledger**
- Add toggle in GeneralLedger.tsx for T-account visual display (already exists in PostingRules via `TAccountDisplay` component — reuse it)

**P8-07: Prior Year Comparison in Bilans Stanja/Uspeha**
- Add prior year column to BilansStanja.tsx and BilansUspeha.tsx, fetching data for `year - 1`

**P8-08: Serbian Month Names in Payroll**
- Replace English month names with Serbian locale names (januar, februar, etc.)

**P8-09: Account Class Validation in Chart of Accounts**
- Validate that account code first digit matches selected `account_class` on save

**P8-10: CIT Tax Return — Merge with PB-1**
- Consolidate any duplicate CIT return logic into the unified PoreskiBilans workflow

---

## Technical Notes

- **New pages** (6+): TaxLossCarryforward, ThinCapitalization, CitAdvancePayments, VatProRata, CapitalGoodsVatRegister, DeferredTax, IntercompanyEliminations
- **New edge functions** (3): sef-webhook, nbs-daily-cron, generate-croso-xml
- **Modified edge functions** (5): generate-pppdv-xml, generate-apr-xml, ebolovanje-submit, fiscalize-receipt, sef-submit
- **Modified pages** (10+): PoreskiBilans, EBolovanje, TravelOrderForm, FixedAssets, GeneralLedger, BilansStanja, BilansUspeha, Invoices, PosTerminal/Sessions, ChartOfAccounts
- **SQL migrations**: Tables for vat_prorata_coefficients, tax_loss_carryforward, capital_goods_vat_register, deferred_tax_items; production order sequence
- All new routes need sidebar entries and route registrations


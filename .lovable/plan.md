

## Section 1: Accounting Module — 23 Improvements (Full Implementation)

This is a large-scale implementation covering compliance fixes, missing flows, and AI enhancements for the accounting module. The work is organized into 6 phases, each building on the previous.

---

### Phase 1: Chart of Accounts Alignment + Audit Trail (Week 1)

**A1. Serbian Kontni Plan alignment**

The current chart_of_accounts has ~21 accounts with non-standard codes (1000, 1200, 2100, etc.). Serbian Pravilnik requires 4-digit codes organized into Classes 0-9.

- Create a database migration to add missing standard accounts:
  - Class 0: Stalna imovina (0100-0900)
  - Class 1: Zalihe i kratkotrajna imovina (already partial)
  - Class 2: Kratkorocne obaveze (already partial, needs 2040 AR, 2410 Banka, 2430 Blagajna, 2431 Ziro, 2470 PDV)
  - Class 3: Kapital (3000 exists)
  - Class 4: Dugorocne obaveze (4300 Primljeni avansi, 4700 PDV)
  - Class 5: Rashodi (5000 already used for WIP/COGS)
  - Class 6: Prihodi (6000 already used)
  - Class 7: Finansijski prihodi/rashodi (missing entirely)
  - Class 8: Vanredni prihodi/rashodi (partially exists: 8000-8300)
  - Class 9: Obracun troskova i ucinka
- Update `seed_tenant_chart_of_accounts()` RPC to include the full plan
- Update BilansStanja to show Classes 0-4 and BilansUspeha to show Classes 5-8
- Normalize AR to consistently use code 2040

**A6. Accounting Audit Trail**

An `audit_log` table already exists with triggers via `log_audit_event()`. Enhancement needed:

- Add `ip_address`, `before_state`, `after_state` columns to `audit_log` if missing
- Add `reason` field to storno operations (mandatory for reversals)
- Ensure triggers exist on: `journal_entries`, `invoices`, `supplier_invoices`, `fiscal_periods`
- Add a dedicated Accounting Audit Log view page (or enhance existing AuditLog.tsx)

---

### Phase 2: Partial Payments + Credit Notes + Advance PDV (Weeks 2-3)

**A2. Partial Payment Handling**

Currently `create_journal_from_invoice` creates full payment. No partial tracking.

- Create `payment_allocations` table: `id, tenant_id, payment_id, invoice_id, amount, allocated_at, created_by`
- Create `allocate_payment()` RPC that:
  - Creates JE: D: 2410 Bank, C: 2040 AR (partial amount)
  - Updates `invoices.amount_paid` and `invoices.balance_due` fields
  - Updates invoice status: paid/partial/unpaid based on balance
- Add `amount_paid` and `balance_due` columns to `invoices` table
- Update Invoices.tsx UI to show balance_due and allow partial payment amounts
- Update OpenItems to reflect partial payments

**A3. Credit Notes (Knjizno odobrenje)**

A `credit_notes` table already exists (linked to returns). Enhancement:

- Add `tax_amount`, `subtotal`, `partner_id`, `legal_entity_id`, `journal_entry_id`, `sef_status` columns
- Create `process_credit_note_post()` RPC:
  - Reverse proportional JE: D: 6000 Revenue, D: 4700 PDV, C: 2040 AR
  - Update original invoice balance
- Add Credit Notes management UI page
- Add SEF submission for credit notes as type='credit_note'

**A4. Advance Payment (Avans) PDV Treatment**

- Create `advance_payments` table: `id, tenant_id, partner_id, amount, currency, invoice_id (final), status, journal_entry_id`
- Create `process_advance_payment()` RPC:
  - On receive: D: 2410 Bank, C: 4300 Primljeni avansi, C: 4700 PDV na avanse
  - On final invoice: D: 4300 Avansi, D: 4700 Reverse avans PDV, net AR adjustment
- Add Advance Payments UI tab in Invoices or separate page

---

### Phase 3: POPDV Validation + Bank Reconciliation (Weeks 3-4)

**A5. POPDV Validation Before Submission**

- Create `validate_popdv_completeness()` RPC:
  - Check all sections populated (Section 2.1 kamate na depozite for 2026)
  - Block submission if gaps found
  - Return detailed validation report
- Update PdvPeriods.tsx to run validation before submit button activates

**A7. Bank Reconciliation**

BankStatements.tsx already has basic matching UI. Enhancement:

- Create `bank_reconciliations` table: `id, tenant_id, bank_account_id, statement_id, status, reconciled_at, reconciled_by`
- Create `bank_reconciliation_lines` table: match entries
- Implement 3-phase auto-match RPC:
  1. Exact match: amount + date
  2. Fuzzy match: partner name + amount within tolerance
  3. AI categorization (calls ai-insights edge function)
- Update BankStatements.tsx with reconciliation panel: matched/unmatched breakdown, drag-drop manual matching
- Generate reconciliation report

---

### Phase 4: Fixed Asset Depreciation + Multi-Currency FX + Kompenzacija (Weeks 4-5)

**A8. Fixed Asset Depreciation Automation**

FixedAssets.tsx exists with individual depreciation. Enhancement:

- Create `run_monthly_depreciation()` RPC:
  - For each active asset, calculate monthly depreciation
  - Auto-generate JE: D: 8100 Depreciation Expense, C: 1290 Accumulated Depreciation
  - Support straight_line and declining_balance methods
- Add disposal flow with gain/loss calculation: D: 2410 Bank (proceeds), D: 1290 Accum Depr, C: Fixed Asset, D/C: 8200/4200 gain/loss
- Add "Run Monthly Depreciation" batch button to FixedAssets page

**A9. Multi-Currency Posting with FX Diff**

FxRevaluation.tsx exists. Enhancement for realized FX on payment:

- Modify payment allocation flow:
  - On foreign currency invoice payment, calculate FX difference
  - Post to 5630 (kursne razlike - rashod) or 6630 (kursne razlike - prihod)
- Add account codes 5630 and 6630 to chart of accounts seed

**A10. Kompenzacija Full Flow**

Kompenzacija.tsx exists with basic offset. Enhancement:

- Create `generate_ios_report()` RPC: IOS (Izvod otvorenih stavki) per partner
- Add kompenzacija agreement PDF generation
- Mark invoices partially/fully paid when kompenzacija is executed
- Add PDF download button for kompenzacija document

---

### Phase 5: Proforma, 3-Way Match, Year-End, Comparative Reports (Weeks 5-6)

**A11. Proforma Invoice**

- Create `proforma_invoices` table mirroring invoices structure but with no JE, no PDV, no SEF
- Add "Convert to Invoice" button that copies all data
- Track `proforma_id` on resulting invoice
- Add Proforma tab/filter on Invoices page

**A12. Supplier Invoice 3-Way Match**

- Create `three_way_match()` validation RPC:
  - Compare: PO amount vs goods receipt quantity vs supplier invoice amount
  - Tolerance threshold: +/-2% configurable
  - Flag discrepancies, auto-approve if within tolerance
- Add match status badge on SupplierInvoices.tsx
- Auto-match button on supplier invoice detail

**A13. Opening Balance for New Year**

YearEndClosing.tsx exists. Enhancement:

- After year N close, auto-create opening balance JE for year N+1
- Include all Class 0-4 account balances
- Source type: 'auto_opening'
- Add "Generate Opening Balances" button to YearEndClosing page

**A14. Comparative Financial Statements**

BilansUspeha and BilansStanja show current period only.

- Add prior year comparison columns to both reports
- Modify `get_bilans_stanja` and `get_bilans_uspeha` RPCs to accept prior period params
- Show current vs prior year with variance percentage

---

### Phase 6: AI-Powered Accounting Enhancements (Weeks 6-8)

**A15. AI Bank Statement Auto-Categorization**

- Create edge function `ai-bank-categorize`:
  - Input: bank statement lines with description, amount, counterparty
  - Output: suggested chart_of_accounts code with confidence score
  - Auto-post above 95% confidence
  - Learn from user corrections
- Add "AI Categorize" button on BankStatements page

**A16. Smart PDV Reconciliation**

- Cross-reference pdv_entries vs SEF accepted invoices vs bank statements
- Flag mismatches in PdvPeriods.tsx

**A17. Year-End AI Pre-Check**

- Create edge function `ai-year-end-check`:
  - Verify: all bank statements reconciled, no draft JEs, all PDV periods submitted, depreciation run, no orphan records
  - Generate readiness report with fix suggestions
- Add pre-check button on YearEndClosing page

**A18. Invoice OCR Auto-Entry**

- Create edge function `invoice-ocr`:
  - Upload invoice image/PDF -> extract supplier PIB, amounts, line items, dates
  - Pre-populate supplier_invoice form
  - Use APR lookup to verify supplier
- Add "Scan Invoice" upload button on SupplierInvoices page

**A19. Cash Flow Predictor**

- Enhance CashFlowForecast with ML prediction:
  - Open AR weighted by customer payment history
  - Upcoming AP, payroll schedule, seasonal patterns
  - 90-day forecast with confidence bands

**A20. Anomaly Detection on JEs**

- Add JE-specific checks to ai-insights edge function:
  - Unusual amount for account
  - Unusual account combination
  - Unusual time/user
  - Flag score > threshold

**A21. Budget vs Actual AI Commentary**

- Enhance ai-analytics-narrative for 'budget' context:
  - Auto-generate natural language explanation per line item variance
  - Recommendations for reallocation

**A22. FX Revaluation Autopilot**

- Daily monitor of FX positions
  - When unrealized gain/loss exceeds threshold, auto-generate revaluation JE draft
  - Notify accountant for approval

**A23. Deferral AI Scheduler**

- AI suggests optimal period allocation for prepaid expenses
- Auto-generate monthly deferral JEs from schedule
- Enhance Deferrals.tsx with AI suggestion button

---

### Technical Details

**New Database Tables:**
1. `payment_allocations` (payment tracking per invoice)
2. `advance_payments` (avans PDV handling)
3. `bank_reconciliations` + `bank_reconciliation_lines`
4. `proforma_invoices` + `proforma_invoice_lines`

**Modified Tables:**
- `invoices`: add `amount_paid`, `balance_due`, `proforma_id` columns
- `credit_notes`: add `tax_amount`, `subtotal`, `partner_id`, `legal_entity_id`, `journal_entry_id`
- `audit_log`: verify `before_state`, `after_state`, `ip_address` columns exist

**New RPCs:**
- `allocate_payment()`
- `process_credit_note_post()`
- `process_advance_payment()`
- `validate_popdv_completeness()`
- `run_monthly_depreciation()`
- `generate_ios_report()`
- `three_way_match()`
- `generate_opening_balances()`

**New Edge Functions:**
- `ai-bank-categorize`
- `ai-year-end-check`
- `invoice-ocr`

**New/Modified UI Pages:**
- Credit Notes page
- Proforma Invoices page/tab
- Enhanced BankStatements with reconciliation
- Enhanced FixedAssets with batch depreciation
- Enhanced BilansStanja/BilansUspeha with comparative columns
- Enhanced YearEndClosing with opening balances + AI pre-check

**Estimated Total:** ~6-8 weeks of implementation, executed phase by phase.



# PRD V3.3 Implementation — Status After Round 8

## Completed This Round (Phases 1-4 + most of 5-6)

### Phase 1: DB Cleanup ✅
- CR3-01: Dropped 2-arg `calculate_payroll_for_run` stub (was producing zero payslips)
- CR3-02: Dropped old 4-arg `complete_pos_transaction` overload
- CR3-03: Verified `leave_type = 'sick'` matches actual enum — no fix needed

### Phase 2: SEF & Edge Functions ✅
- CR3-05: `sef-cancel-sales-invoice` validation errors now return 400 (not 500)
- CR-20: `generateUBLXml` now passes `invoice.issue_date` to `determineVatCategory` for S10/S20 codes
- CR2-11: `generate-apr-xml` migrated to service_role + getClaims + maybeSingle
- P3-07: Already returned proper HTTP status codes ✅
- P3-05: Storno already used actual VAT categories ✅

### Phase 3: Accounting & GL ✅ (All already fixed)
- P3-12: GL reversal on FIFO failure ✅
- P3-13: 3-way match price comparison ✅
- P3-15: Debit note VAT line ✅
- P3-18: NBS unit division ✅
- P3-21: Button labels correct ✅
- P3-23: BillingReference in storno XML ✅

### Phase 4: Feature Completeness ✅
- P4-01: Added `discount_percent` column to `invoice_lines` + UI rabat field + calc logic
- P4-02: `vat_date` already implemented ✅
- P4-03: Expanded PB-1 from 34 to 70 AOP positions
- P4-08: Fixed PP-PDV XML root element to `<ObrazacPPPDV>`
- P4-09: Credit note 381 + CreditNote root already correct ✅
- P4-16: Travel per diem already has +1 ✅
- P4-17: Added severance minimum enforcement (ZoR čl. 158)
- CR-27: KpoBook columns already correct ✅

### Phase 5: Statutory Features ✅ (Most already exist)
- P5-01: Year-end closing with `perform_year_end_closing` RPC ✅
- P5-02: Opening balances in GeneralLedger.tsx ✅
- P5-03: Fiscal period lock/unlock UI ✅
- P5-04: Cash journal (CashRegister.tsx) ✅
- P5-13: Regres in employee_salaries ✅

### Phase 6: Compliance ✅ (Most already exist)
- P7-06: JMBG mod-11 checksum already in ebolovanje-submit ✅
- P7-07: generate-apr-xml auth fixed in Phase 2 ✅

---

## Remaining Items (Future Rounds)

### P5-05: Kartica partnera (Partner Statement)
New page: chronological transaction history per partner with running balance. Not yet implemented.

### P6-03: Quarterly CIT advance payments
Calculator and schedule tracking. Not yet implemented.

### P6-08: Non-deductible expense auto-calculation
Auto-calculate limits: representation 0.5%, advertising 10% of revenue.

### P8-01 through P8-10: Polish items
BOM cost, loyalty points, POS cash reconciliation, production number sequence, T-account view, prior year comparison, Serbian locale months, account class validation, CIT/PB-1 merge.

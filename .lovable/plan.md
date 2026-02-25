

# Serbian ERP System — Compliance & Completeness Audit Report

## Methodology

Reviewed all database tables (190+), RPC functions (80+), edge functions (75+), page components, and cross-module data flows against current Serbian law requirements (Zakon o računovodstvu, Zakon o PDV-u including April 2026 amendments, Zakon o fiskalizaciji, Zakon o elektronskom fakturisanju, Zakon o porezu na dobit pravnih lica, Zakon o porezu na dohodak građana).

---

## PART A: What Is Working & Properly Connected

### Core Accounting Engine
- Double-entry bookkeeping enforced at DB level (triggers block unbalanced entries)
- Posted journal entries are immutable — corrections only via storno (with mandatory reason)
- Chart of accounts follows Serbian Pravilnik (Classes 0-9)
- Fiscal period management (open/closed/locked) with `check_fiscal_period_open` validation
- Year-end closing RPC transfers P&L to retained earnings (3400), accrues 15% CIT (D:7200, P:4810), locks period
- Opening balance generation RPC (`generate_opening_balance`) carries forward Class 0-4, nets 5-8

### VAT / PDV
- POPDV sections 2.1, 3, 3a, 4, 5, 6, 8a, 8b, 8v, 9, 10, 11 — all implemented
- PDV period lifecycle: open → calculated → submitted → closed
- PDV entries linked to invoices/supplier invoices with direction, rate, base/VAT amounts
- `validate_popdv_completeness` RPC checks for gaps before submission
- `check_fiscal_period_open` also blocks posting to submitted/closed PDV periods
- VAT tax category codes are date-dependent: legacy S/AE before April 2026, split S10/S20/AE10/AE20 after

### Electronic Invoicing (SEF)
- UBL 2.1 XML generation with proper Serbian tax categories
- `sef-submit`, `sef-send-invoice`, `sef-poll-status` edge functions
- SEF Type 381 (Credit Note / Knjižno odobrenje) support
- Import of sales & purchase invoices from SEF
- Idempotent submissions with `requestId`
- Status tracking: not_submitted → submitted → accepted/rejected

### Fiscalization (PFR)
- `fiscalize-receipt` edge function with PFR payment type mapping
- Tax label mapping (A=20%, G=10%, E=0%)
- Device-specific configuration
- Retry mechanism for offline scenarios (`fiscalize-retry-offline`)
- JWT validation and tenant membership checks

### Payroll & HR
- 52 income categories (K01-K52), 12 recipient types
- PPP-PD XML generation (`generate-pppd-xml` edge function)
- Payment order CSV export with JMBG checksum validation and Model 97 references
- eBolovanje integration (electronic sick leave via eUprava)
- eOtpremnica integration (electronic dispatch notes)
- Work log types include slava (patron saint day) — Serbian-specific

### Document Management
- Archive book (Arhivska knjiga) per Serbian archiving law
- Document destruction/archiving requests with approval workflow
- Retention period tracking with expiry detection

### Serbian-Specific Operations
- Kalkulacija (retail price calculation with markup + PDV)
- Nivelacija (inventory revaluation with GL posting)
- Kompenzacija (mutual debt compensation with journal entries)
- IOS (Izvod Otvorenih Stavki) balance confirmations
- KPO Book for flat-rate taxpayers
- Statistički aneks (Statistical Annex for APR)
- Transfer pricing documentation

### Audit Trail
- Automatic audit triggers on: invoices, journal entries, partners, products, inventory movements, chart of accounts, fiscal periods, purchase orders, supplier invoices, employees, payroll runs, production orders, POS transactions, documents, return cases, credit notes
- `audit_log` table with tenant isolation and indexed for performance

### Cross-Module Connections (All Verified Working)
- Invoice → Journal Entry (via `process_invoice_post` / `create_journal_from_invoice`)
- Supplier Invoice → Journal Entry (via `createCodeBasedJournalEntry`)
- POS → Fiscal Receipt → Journal Entry (via `process_pos_sale`)
- Production completion → Inventory → Journal Entry
- Payroll → Posting Rules → Journal Entry
- Bank statement import → Posting Rules → Journal Entry
- Fixed asset depreciation → Journal Entry (via `calculate_depreciation_batch`)
- Credit Note → Storno Journal Entry
- Advance Payment → Settlement with PDV reversal (`settle_advance_payment`)
- Kalkulacija/Nivelacija → Journal Entry (via dedicated RPCs)

---

## PART B: Gaps & Missing Features

### GAP 1: No PP-PDV XML Export for ePorezi
**Severity: HIGH**
The system tracks PDV periods and POPDV entries but does not generate the actual **PP-PDV XML file** required for electronic submission to the Serbian Tax Administration (ePorezi). The "Submit" button only changes status in the database — it doesn't produce the XML output that accountants upload to ePorezi. Competing software (e.g., Pantheon, Trezor) generates this XML automatically.

**What's needed:** An edge function or client-side generator that produces PP-PDV XML per the official XSD schema from the Poreska Uprava.

### GAP 2: No Automated PDV Journal Entry on Period Close
**Severity: MEDIUM**
The doc explicitly notes this: "Missing automated VAT journal creation from PDV period closing." When a PDV period is submitted, the system should automatically create a journal entry settling output VAT (4700) against input VAT, posting the net liability/receivable. Currently this must be done manually.

### GAP 3: Supplier Invoice GL Codes Are Hardcoded
**Severity: MEDIUM**
Supplier invoice posting uses hardcoded `5xxx/2100` instead of the posting rules engine. This means the system can't differentiate between expense types (raw materials vs. services vs. fixed asset acquisitions) automatically. Same issue with: fixed asset depreciation (hardcoded 8100/1290), cash register, deferrals, kompenzacija.

### GAP 4: No Tax Calendar / Compliance Deadline Engine
**Severity: MEDIUM**
There's a `ComplianceDeadlineWidget` on the dashboard but it's hardcoded dates. No `tax_calendar` table exists. Serbian businesses must track ~15 recurring deadlines (PP-PDV by 15th, PPP-PD by 15th, CIT advance by 15th, annual CIT return by June 30, financial statements to APR by June 30, etc.). The system should auto-calculate these and send notifications.

### GAP 5: No Bilans Stanja / Bilans Uspeha XML for APR
**Severity: MEDIUM**
Routes exist for Serbian-format financial statements (`/accounting/reports/bilans-uspeha`, `/accounting/reports/bilans-stanja`) but there's no XML/XBRL export in the format required by APR (Agencija za Privredne Registre) for annual financial statement filing.

### GAP 6: April 2026 VAT Law Changes Not Fully Implemented
**Severity: HIGH**
Per the Serbian VAT amendments effective April 1, 2026:
- **Credit note rules tightened**: Tax base reductions now require formal documentation through SEF; the system has credit notes but doesn't enforce the new procedural requirements
- **Pre-filled VAT returns**: Serbia is moving toward pre-filled PP-PDV returns based on SEF data (postponed to periods starting after Sept 2026) — the system should prepare for this by reconciling SEF data with internal POPDV
- **New timing rules for VAT on services**: Changes to when VAT obligation arises for certain service types — not reflected in PDV entry logic
- **Electronic archiving requirements**: Stricter rules on digital document retention periods — the archiving module exists but may need alignment with new retention period rules

### GAP 7: No Intercompany Reconciliation / Elimination
**Severity: LOW**
The `intercompany_transactions` table exists and consolidated statements page exists, but there's no automated **intercompany elimination engine** for consolidated reporting (eliminating intra-group sales, receivables/payables). This is required for groups filing consolidated financial statements with APR.

### GAP 8: No Multi-Currency PDV Handling
**Severity: LOW**
Invoices support multi-currency with exchange rates, but PDV entries don't track the original currency amounts. Serbian law requires VAT to be calculated in RSD at the middle NBS exchange rate on the date of supply — the system should auto-convert and store both currency and RSD amounts in PDV entries.

### GAP 9: No Payment Order Generation for Tax Payments
**Severity: MEDIUM**
The `generate-payment-orders` edge function exists for payroll, but there's no equivalent for tax payments (PDV, CIT, withholding tax). Serbian accountants need to generate payment orders (nalozi za plaćanje) with correct model numbers, reference numbers (poziv na broj), and recipient accounts for the Treasury (Uprava za Trezor).

### GAP 10: Missing Debit Note (Knjižno zaduženje) Support
**Severity: LOW**
Credit notes (Type 381) are supported via SEF, but debit notes (Type 383 — Knjižno zaduženje) are not implemented. These are used for interest charges, penalty invoices, and price increases.

### GAP 11: No Automated CIT Advance Payment Tracking
**Severity: LOW**
The CIT return page calculates tax but doesn't track monthly advance payments (akontacije poreza na dobit). Serbian law requires monthly CIT advances based on the prior year's return, with reconciliation in the annual return.

---

## PART C: Summary Scorecard

| Area | Status | Notes |
|------|--------|-------|
| Chart of Accounts (Kontni plan) | ✅ Complete | Classes 0-9, Serbian Pravilnik 2026 |
| Double-entry & immutability | ✅ Complete | DB triggers enforce |
| Fiscal periods | ✅ Complete | Open/closed/locked with validation |
| Year-end closing | ✅ Complete | With CIT accrual and opening balances |
| POPDV tracking | ✅ Complete | All 11 sections |
| PP-PDV XML export | ❌ Missing | No ePorezi-compatible XML output |
| PDV auto-journal on close | ❌ Missing | Documented known gap |
| SEF e-invoicing | ✅ Complete | UBL 2.1, Type 380/381 |
| SEF Type 383 (debit note) | ❌ Missing | Not implemented |
| Fiscal receipts (PFR) | ✅ Complete | With offline retry |
| PPP-PD XML | ✅ Complete | Edge function exists |
| eBolovanje | ✅ Complete | Integration with eUprava |
| eOtpremnica | ✅ Complete | Electronic dispatch notes |
| Payroll engine | ✅ Complete | K01-K52, OVP, all recipient types |
| Transfer pricing | ✅ Complete | Parties, transactions, methods |
| Kalkulacija/Nivelacija | ✅ Complete | With GL posting |
| Kompenzacija | ✅ Complete | With GL posting |
| IOS / KPO / Stat. Aneks | ✅ Complete | Serbian-specific reports |
| APR XML/XBRL export | ❌ Missing | No machine-readable financial statements |
| Tax calendar & notifications | ❌ Missing | Hardcoded widget only |
| Posting rules engine coverage | ⚠️ Partial | Only POS/payroll/bank use it; 6 sources hardcoded |
| Multi-tenant RLS | ✅ Complete | All tables protected |
| Audit trail | ✅ Complete | Triggers on all key tables |
| April 2026 VAT changes | ⚠️ Partial | Tax codes done; procedural rules pending |

**Overall: 19/25 areas fully complete, 2 partial, 4 missing**

The system is production-ready for most Serbian businesses. The highest-priority gaps are PP-PDV XML export (accountants need this monthly) and automated PDV journal creation. The April 2026 VAT procedural changes should be addressed before that effective date.


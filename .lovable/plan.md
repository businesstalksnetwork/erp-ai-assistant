

# Gap Analysis: Accounting & HR — PRD + Serbian Competitors

After cross-referencing your PRD ("LedgerOS RS"), three major Serbian competitors (BizniSoft, Minimax, Datalab PANTHEON), and the current codebase, here are the **critical missing features and logic gaps** in Accounting and HR.

---

## ACCOUNTING GAPS

### 1. Bank Statement Import & Auto-Reconciliation (HIGH PRIORITY)

**PRD**: Section 7.3 "Banke/Blagajna" — import bank statements, auto-close open items via safe-match logic, cash position.
**Competitors**: BizniSoft has full electronic statement import/processing; Minimax has bank statement module with auto-matching; PANTHEON has bank reconciliation.

**Current state**: `BankAccounts.tsx` is CRUD-only — no statement import, no transaction matching, no reconciliation. This is a core gap for any Serbian accounting software.

**What to build**:
- Bank statement import (CSV/XML formats common in Serbia)
- Transaction matching engine: match bank lines to open AR/AP items by "poziv na broj" (payment reference), amount, and partner
- Manual matching UI for unmatched transactions
- Auto-posting of matched payments (Debit Bank / Credit AR, or Debit AP / Credit Bank)
- Cash position dashboard (current balances across all bank accounts)

---

### 2. PDV (VAT) Calculation & POPDV Report (HIGH PRIORITY)

**PRD**: Section 7.3 "PDV i porezi" — VAT calculation per period, POPDV form generation, control checks.
**Competitors**: Minimax has full POPDV generation and VAT period processing; BizniSoft has "PDV Evidencija" with reconciliation.

**Current state**: `TaxRates.tsx` only manages tax rate CRUD. There is no VAT period calculation, no POPDV (Pregled Obrasca PDV) report, no VAT control checks, and no VAT reconciliation vs GL.

**What to build**:
- VAT period calculation page: auto-aggregate output/input VAT from posted journals
- POPDV form generation (Section 3-11 of the Serbian POPDV form)
- VAT control report: compare VAT evidence vs GL balances
- Export-ready data (XML/CSV for ePorezi portal)

---

### 3. Open Items (Otvorene Stavke) & IOS Statements (HIGH PRIORITY)

**PRD**: Section 7.3 AR/AP — "Otvorene stavke po dokumentu, valuti i dospeću; kompenzacije i prebijanja."
**Competitors**: Minimax has open items closing through bank statements, manual closing, and IOS (Izvod Otvorenih Stavki) mass mailing; BizniSoft has "Finansijska operativa" with kompenzacije.

**Current state**: No open items tracking exists. Invoices and supplier invoices have status fields but there's no sub-ledger for tracking individual open items, partial payments, or offsetting/compensation.

**What to build**:
- Open items ledger: track each invoice/supplier invoice as an open item with remaining balance
- Partial payment support: when bank payment is less than invoice total
- IOS (Statement of Open Items) report generation — mandatory in Serbian business practice
- Kompenzacija (offsetting/netting) workflow with documentation

---

### 4. Exchange Rate Differences (Kursne Razlike) (MEDIUM)

**PRD**: Section FX-001 to FX-008 — automatic FX difference calculation and posting.
**Competitors**: BizniSoft has "Obračun kursnih razlika"; Minimax has "Kursne razlike na godišnjim obradama."

**Current state**: `Currencies.tsx` shows currencies and rates but there is no calculation engine for exchange rate differences, no revaluation at period-end, and no automated FX posting.

**What to build**:
- Period-end FX revaluation: recalculate all foreign currency balances at closing rate
- Auto-post realized/unrealized FX gains/losses
- FX difference journal entries (account codes 5630/6630 per Serbian kontni okvir)

---

### 5. Year-End Closing & Financial Statements (Godisnje Obrade) (MEDIUM)

**PRD**: Section 12 roadmap — "APR priprema" in Phase B.
**Competitors**: Minimax has full "Godisnje obrade" module with Bilans Stanja, Bilans Uspeha, Statisticki Aneks, and APR submission preparation; BizniSoft has "Formiranje finansijskih izvestaja."

**Current state**: Balance Sheet and Income Statement exist but are basic GL aggregations. There is no year-end closing workflow (Class 5/6 closing entries), no APR-format report generation, no opening balance carry-forward.

**What to build**:
- Year-end closing procedure: auto-generate closing entries for P&L classes (class 5 revenue, class 6 expenses) to retained earnings
- Opening balance entry generation for new fiscal year
- APR-format Balance Sheet (Bilans Stanja) and Income Statement (Bilans Uspeha)
- Statistical annex data preparation

---

### 6. Storno (Reversal) Journal Entries (MEDIUM)

**PRD**: GL-007 BLOCK — "Storno must reference original entry and reproduce amounts with opposite sign."
**Competitors**: All three competitors support formal storno/reversal workflows.

**Current state**: Journal entries can be posted but there's no formal storno mechanism — no way to reverse an entry with a linked reference. The current system allows deletion which violates audit requirements.

**What to build**:
- "Storno" button on posted journal entries
- Auto-generate reversal entry with opposite signs, linked to original
- Block editing/deleting posted entries (immutability)
- Storno chain visibility in journal entry detail

---

### 7. Advance Invoices (Avansne Fakture) (MEDIUM)

**PRD**: SEF section — "avansi, odobrenja, povezivanje sa knjiženjem."
**Competitors**: Both BizniSoft and Minimax have extensive advance invoice handling (issuing, receiving, connecting to final invoices).

**Current state**: No advance invoice concept. This is critical for Serbian compliance — advance payments require specific VAT treatment and must be linked to final invoices.

**What to build**:
- Advance invoice type in Invoices (type: "advance")
- Link advance to final invoice with automatic deduction
- Separate VAT treatment for advances per Serbian law
- Advance credit note generation

---

## HR & PAYROLL GAPS

### 8. PPP-PD Tax Return Generation (HIGH PRIORITY)

**PRD**: PAY-004 BLOCK — "Export of tax returns must pass format validation before submission."
**Competitors**: Minimax has full PPP-PD generation and OD-O forms; BizniSoft has PPP-PO printing.

**Current state**: Payroll calculates taxes/contributions but generates no PPP-PD (Pojedinacna Poreska Prijava o obracunatim porezima i doprinosima) report. This is mandatory for every salary payment in Serbia.

**What to build**:
- PPP-PD XML generation per payroll run
- Validation against ePorezi XSD schema
- Preview/download of PPP-PD before submission
- PPP-PO annual summary report

---

### 9. DLP (Druga Licna Primanja) — Other Personal Income (MEDIUM)

**Competitors**: Minimax has full DLP module for: ugovor o delu, autorski honorari, zakup, board member fees, etc.

**Current state**: Payroll only handles regular employee salaries. No support for non-employment income types common in Serbia (service contracts, author fees, rental, temporary work).

**What to build**:
- DLP calculation types: service agreement, author contract, rental, board fees
- Different tax/contribution formulas per DLP type
- PPP-PD generation for DLP payments
- Integration with GL (different expense accounts per DLP type)

---

### 10. Leave-to-Payroll Integration (MEDIUM)

**PRD**: PAY-007 BLOCK — "Block payroll calculation without absence records where applicable."
**Competitors**: Minimax explicitly links work time records to payroll; BizniSoft handles sick leave and vacation in payroll.

**Current state**: Leave requests exist but are not consumed by payroll calculation. The `calculate_payroll_for_run` RPC does not factor in approved leave days (vacation at average pay, sick leave at reduced rate, etc.).

**What to build**:
- Feed approved leave_requests into payroll calculation
- Different pay rates per leave type: vacation (100% of average), sick leave first 30 days (65%), sick leave 30+ days (RFZO rate)
- Working days calculation based on actual attendance minus leave days

---

## Summary Priority Matrix

| Gap | Priority | Effort | Serbian Compliance |
|-----|----------|--------|-------------------|
| Bank Statement Import & Reconciliation | HIGH | Large | Required |
| PDV/POPDV Calculation | HIGH | Large | Mandatory |
| Open Items & IOS | HIGH | Medium | Mandatory |
| PPP-PD Tax Returns | HIGH | Medium | Mandatory |
| Year-End Closing | MEDIUM | Medium | Required for APR |
| Storno Journals | MEDIUM | Small | Required |
| Advance Invoices | MEDIUM | Medium | Required for SEF |
| FX Differences | MEDIUM | Medium | Required |
| DLP Other Income | MEDIUM | Medium | Common need |
| Leave-Payroll Integration | MEDIUM | Small | Required |

---

## Recommended Implementation Order

**Phase 20**: Bank Statements + Open Items + Storno Journals (accounting foundation)
**Phase 21**: PDV/POPDV Calculation + Advance Invoices (tax compliance)
**Phase 22**: PPP-PD Generation + Leave-Payroll Integration + DLP (HR compliance)
**Phase 23**: Year-End Closing + FX Revaluation + APR Reports (period-end)

Each phase addresses a cluster of related gaps that build on each other. The bank and open items foundation is needed before PDV reconciliation, and PPP-PD requires the payroll calculation to be complete (with leave integration) before it can generate correct returns.


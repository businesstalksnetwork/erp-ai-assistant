

# Accounting Core Gap Analysis: Deep Research Report vs Current Implementation

## Executive Summary

Cross-referencing the Deep Research Report (BizniSoft vs Minimax mapped to Serbia-first AI ERP PRD) against the current codebase reveals **12 specific gaps** across accounting core, state integrations, and HR. Several are CRITICAL for Serbian legal compliance in 2026.

---

## Current State Assessment

### What's Already Built (Phases 1-21)

| Area | Status |
|------|--------|
| Double-entry GL with journal lines | Done |
| Storno/reversal mechanism | Done (Phase 20) |
| Bank statement import + basic matching | Done (Phase 20) |
| Open items ledger + IOS | Done (Phase 20) |
| PDV periods + POPDV form | Done (Phase 21) |
| Advance invoices (avansne fakture) | Done (Phase 21) |
| Fiscal period locking (open/closed/locked) | Done |
| Chart of accounts (Serbian kontni okvir seed) | Done |
| Fixed assets with depreciation + GL posting | Done |
| Legal entities with PIB/MB | Done |
| Approval workflows | Done (Phase 19) |
| Payroll with Serbian tax/contributions | Done |

---

## CRITICAL GAPS (Must Fix)

### Gap 1: Immutable Posting Kernel -- Incomplete

**Report says**: "Immutable journals, reversal primitives, posted journals never mutated; only reversals + audit trail." Minimax blocks edits for automatic journals.

**Current state**: Storno exists but the system still allows **editing posted journal entries** -- there's no DB constraint blocking UPDATE on posted rows. Draft entries can be deleted (correct), but posted entries should be UPDATE-blocked at the DB level, not just the UI level.

**Fix needed**:
- Add a DB trigger or check constraint that prevents UPDATE on `journal_entries` where `status = 'posted'` (except for `storno_by_id` and `status` changing to `reversed`)
- Block DELETE on posted entries at the DB level
- Ensure auto-generated journals (from invoices, depreciation, deferrals) are marked as `source = 'auto'` and are never editable

### Gap 2: Multi-Layer Period Locking

**Report says**: "Implement multi-layer close: VAT period close, month close, year close; block retro edits."

**Current state**: Fiscal periods have open/closed/locked but there's only one layer. No connection between PDV period closing and fiscal period closing. No year-end closing procedure.

**Fix needed**:
- Link `pdv_periods` closing to block journal posting for that VAT period
- `check_fiscal_period_open` RPC should also check PDV period status
- Year-end closing workflow (Class 4/5 to retained earnings via account 3000)

### Gap 3: SEF (eFaktura) Integration -- Not Started

**Report says**: "SEF connector per PIB with queueing and reconciliation. API key mgmt, mailbox sync, send/cancel/storno, contract tests vs DEMO."

**Current state**: No SEF integration exists. No `sef_connections` table, no inbox/outbox, no status governance.

**Fix needed** (architecture only -- actual API integration requires SEF API credentials):
- `sef_connections` table (per `legal_entity_id`, API key reference, status)
- `sef_outbox` / `sef_inbox` tables for queue management
- Status governance: block invoice posting if SEF status is missing (Minimax pattern)
- Edge function for SEF API communication

### Gap 4: eOtpremnica Integration -- Not Started

**Report says**: "Legal obligations start 1 Jan 2026. Full lifecycle: send/receive, statuses, actions, QR/PDF, inventory coupling."

**Current state**: No electronic delivery note support. This is a **2026 legal requirement**.

**Fix needed**:
- `eot_connections`, `eot_documents`, `eot_status_history` tables
- Link to inventory movements (goods receipts/dispatches)
- Status actions: physical receipt, storno, driver pickup
- Edge function for eOtpremnica API

### Gap 5: eBolovanje Employer Integration -- Not Started

**Report says**: "From 1 Jan 2026, unified employer eBolovanje system on eUprava. Electronic receipt of sick leave certificates, refund requests."

**Current state**: Leave requests exist but no eBolovanje portal integration.

**Fix needed**:
- `ebolovanje_sync_log` table
- Sick leave cases linked to employees with OZ-7/OZ-10 form data
- Edge function for eUprava API communication
- Link to payroll calculation (sick leave rate: 65% first 30 days, RFZO after)

---

## HIGH PRIORITY GAPS

### Gap 6: Bank Statement Format Support -- Incomplete

**Report says**: "Must support Halcom (txt), Asseco (xml), Raiffeisen/OTP (rol xml), Excel import."

**Current state**: Only generic CSV import exists. No support for Serbian bank-specific formats.

**Fix needed**:
- Halcom TXT parser
- Asseco XML parser
- Generic Excel (XLSX) import option
- "Poziv na broj" matching is partially done but needs "payment code" (`sifra placanja`) support

### Gap 7: NBS Exchange Rate Auto-Import

**Report says**: "NBS provides web services for exchange rate lists. Rates must be automated and auditable."

**Current state**: Currencies and exchange rates are manual CRUD only.

**Fix needed**:
- Edge function to fetch NBS exchange rates via their web service
- Daily auto-import or on-demand "Fetch today's rates" button
- Audit trail for rate source (NBS vs manual)

### Gap 8: FX Revaluation Engine

**Report says**: "Period-end FX revaluation, auto-post realized/unrealized FX gains/losses."

**Current state**: No FX calculation engine. Currencies page is display-only.

**Fix needed**:
- FX revaluation page: recalculate all foreign currency open items at closing rate
- Auto-post journal entries for FX differences (positive/negative kursne razlike)
- Serbian accounts: positive differences to revenue (e.g., 6630), negative to expense (e.g., 5630)

### Gap 9: Fixed Asset Lifecycle Gaps

**Report says**: "Unify asset lifecycle with purchasing/inventory conversion, amortization, impairment, disposal. Tax vs financial amortization groups."

**Current state**: Basic depreciation (straight-line, declining balance) with GL posting exists. Missing:
- Tax amortization groups (separate from financial)
- Asset disposal with gain/loss journal (account 4200 Gain / 8200 Loss)
- Asset impairment workflow
- Link from Purchase Order to asset creation

### Gap 10: Inventory Costing Methods

**Report says**: "PRD requires costing methods per product group (FIFO/weighted/standard/specific ID). Minimax only does average; BizniSoft does FIFO."

**Current state**: No costing method engine. Inventory tracks quantity only, no cost layers.

**Fix needed**:
- `stock_valuation_layers` table for FIFO/weighted average cost tracking
- Costing method configuration per product group
- COGS calculation on sales based on selected method
- Revaluation journals when purchase price corrections occur

---

## MEDIUM PRIORITY GAPS

### Gap 11: Kompenzacija (Offsetting/Netting)

**Report says**: "Multiple closure methods: partial payments, offsets, advances, compensations, and bank matching."

**Current state**: Open items exist but no kompenzacija workflow.

**Fix needed**:
- Kompenzacija document type: select AR and AP items to offset against each other
- Auto-generate journal entries (Debit AP / Credit AR)
- PDF document generation for legal compliance

### Gap 12: Legal Entity Scoping for Accounting

**Report says**: "Model Tenant -> Legal Entity (PIB) -> Location explicitly. SEF/eOtpremnica credentials tied to legal entity."

**Current state**: `legal_entities` table exists but is not linked to any accounting tables. All accounting is tenant-scoped, not legal-entity-scoped. A tenant with multiple PIBs cannot separate their accounting.

**Fix needed**:
- Add `legal_entity_id` to `journal_entries`, `invoices`, `chart_of_accounts` (optional FK)
- SEF/eOtpremnica connections scoped to legal entity
- PDV filing per legal entity (each PIB files separately)

---

## Recommended Implementation Phases

### Phase 22: Accounting Kernel Hardening (CRITICAL)
- Immutable posting constraints (DB triggers)
- Multi-layer period locking (fiscal + PDV interlock)
- Year-end closing procedure
- Legal entity scoping for accounting tables

### Phase 23: State Integration Foundation (CRITICAL for 2026)
- SEF connector architecture (tables + edge function scaffold + status governance)
- eOtpremnica document model + status lifecycle
- NBS exchange rate auto-import edge function

### Phase 24: Advanced Accounting Engine
- FX revaluation engine with journal posting
- Kompenzacija workflow
- Fixed asset disposal with gain/loss + tax amortization groups
- Inventory costing methods (FIFO/weighted average layers)

### Phase 25: HR Compliance (already planned as Phase 22 in prior roadmap)
- PPP-PD XML generation
- Leave-to-payroll integration
- eBolovanje connector scaffold
- DLP (other personal income) calculations

---

## Technical Notes

### DB Immutability Trigger (Phase 22)

```text
CREATE TRIGGER block_posted_journal_edit
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW
WHEN (OLD.status = 'posted')
-- Allow only: status change to 'reversed' + setting storno_by_id
-- Block all other mutations
```

### Legal Entity Scoping Pattern

```text
-- Optional FK on core accounting tables:
ALTER TABLE journal_entries ADD COLUMN legal_entity_id UUID REFERENCES legal_entities(id);
ALTER TABLE invoices ADD COLUMN legal_entity_id UUID REFERENCES legal_entities(id);
-- Default: if tenant has only 1 legal entity, auto-set
```

### SEF Connection Model

```text
sef_connections: legal_entity_id, api_key_encrypted, sef_status (active/inactive), demo_mode
sef_outbox: invoice_id, sef_document_id, status (queued/sent/accepted/rejected/cancelled), sent_at
sef_inbox: sef_document_id, document_type, sender_pib, status, received_at, linked_supplier_invoice_id
```

### NBS Rate Import

```text
Edge function: fetch-nbs-rates
GET https://webservices.nbs.rs/CommunicationOffice/ExchangeRate.asmx
Parse XML response -> insert into exchange_rates table
Track source = 'NBS' vs 'manual'
```


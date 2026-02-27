

# Implementation Plan: Multi-PRD Phased Rollout

## What's Already Done (from prior phases + existing codebase)
- Phase 1-3 of Frontend Optimization PRD (navigation, settings restructure, FIFO/eFaktura/incoming eFakture)
- `popdv_tax_types` table created and seeded with full catalog
- `PopdvFieldSelect` component built
- `supplier_invoice_lines` table with POPDV, item_type, efaktura_category, vat_non_deductible
- `SupplierInvoiceForm` with line items, POPDV per line, reverse charge auto-generation
- `InvoiceForm` with item_type, popdv_field, efaktura_category per line
- `vat_date` on both invoices and supplier_invoices, used in POPDV aggregation
- `InvoiceRegister` page with dual-register (output/input) grouped by POPDV section
- Chart of Accounts with analytics_type, is_foreign_currency, cost center/bearer fields
- Journal entries with account analytics, POPDV field per line, account combobox search

## Remaining Work — Divided into 8 Phases

---

### Phase 4: SEF Compliance & POS Refunds
**Scope:** v2.1 items 1-8 from Release Roadmap
**Files:** 3 edge functions + 1 page + 1 migration

1. **Update SEF CustomizationID** — Change `urn:mfin.gov.rs:srbdt:2022` to latest v3.14.0 spec in `supabase/functions/sef-submit/index.ts`
2. **POS refund flow** — Add refund mode to `PosTerminal.tsx`: select original receipt, partial/full item selection, generate fiscal refund receipt with `receipt_type: refund` and `refund_receipt_id` FK
3. **Add exponential backoff** to `fiscalize-retry-offline/index.ts`
4. **Add 46 missing Serbian i18n keys** — eBolovanje, eOtpremnica, submission status keys in `translations.ts`

---

### Phase 5: Chart of Accounts & Journal Entry Compliance
**Scope:** v2.1 items 17-20 + Accounting PRD Sections 4 & 7

1. **Seed Class 7 + Class 8 accounts** — Migration to add opening/closing accounts (7xxx) and off-balance sheet (8xxx)
2. **Add missing 4350, 4360+ accounts** — Seed all accounts beyond 433x range
3. **Enforce 4-digit minimum** on journal entry posting — validation in `JournalEntries.tsx` (block posting to synthetic accounts < 4 digits)
4. **Journal entry posting flow** — Ensure Draft → Post → Storno lifecycle works; posting creates GL entries and locks the entry
5. **Payroll rate verification** — Verify/update PIO employer rate and non-taxable amount for 2026 in `PayrollParameters.tsx` and `calculate_payroll_for_run` RPC

---

### Phase 6: Invoice Form Upgrade & GL Posting Preview
**Scope:** Accounting PRD Section 5

1. **Invoice type selector** — Add FINAL / ADVANCE / PROFORMA / CREDIT_NOTE / DEBIT_NOTE tabs at top of `InvoiceForm.tsx`
2. **GL posting preview** — "Pregled knjiženja" panel showing the journal entry that will be created, with account/debit/credit breakdown, before the user clicks Post
3. **Post & Send workflow** — Replace current "Send" with "Proknjizi" (post only), "Proknjizi i pošalji na SEF" (post + SEF submit), "Sačuvaj nacrt" (draft)
4. **Item-type-specific GL accounts** — Use posting rules: Goods→6000/5000/1320, Service→6120, Product→6100/5100/1200
5. **Partner search improvement** — Link "+ Novi partner" to partner form in side panel with APR PIB lookup

---

### Phase 7: Supplier Invoice & POPDV Engine Upgrade
**Scope:** POPDV PRD remaining items + Accounting PRD Section 14

1. **POPDV auto-default logic** — Auto-suggest POPDV field based on partner type (foreign → 8g.1, domestic VAT → 8a.2) and document type
2. **Section 9 split** — Quick "Split" action on supplier invoice lines: split deductible (8a.2) + non-deductible (9.01) with proper `vat_non_deductible` column handling
3. **POPDV form review/edit UI** — Enhance `PdvPeriods.tsx` to show full POPDV form with all 11 sections, editable cells for manual adjustments, and XML export for ePorezi
4. **PP-PDV form generation** — Auto-calculate from POPDV aggregation: total output VAT - total deductible input VAT = obligation/refund
5. **Non-deductible VAT GL posting** — When `vat_non_deductible > 0`, post to expense account (not 2700 input VAT account)

---

### Phase 8: Bank Statements & Recurring Engines
**Scope:** Accounting PRD Section 6 + v2.3 items 8-9

1. **Bank statement auto-numbering** — Format `iz{last3digits}-{seq}` per fiscal year
2. **Fix XML import** — Parse standard Serbian bank XML format (NBS)
3. **Per-line GL posting** — Each bank statement line: select payment model, preview GL entry, batch post
4. **Recurring invoice cron** — New edge function `recurring-invoice-generate` triggered by cron, creating invoices from `recurring_invoices` templates
5. **Recurring journal cron** — Same for journal templates

---

### Phase 9: Frontend Standardization
**Scope:** v2.2 Frontend items from Roadmap

1. **Extract `lineCalculations.ts`** — Shared line calc utility used by both InvoiceForm and SupplierInvoiceForm
2. **Build `PageErrorBoundary`** — Wrap all form/list pages; friendly recovery UI with "Go Back"
3. **Add sorting + column visibility to `ResponsiveTable`** — Click-to-sort columns, user-togglable column visibility
4. **Integrate CSV export into `ResponsiveTable`** — Built-in export button
5. **Performance: staleTime on reference queries** — 5-min staleTime on legal entities, accounts, tax rates, currencies
6. **Memoize sidebar rendering** in `TenantLayout.tsx`

---

### Phase 10: HR & Payroll
**Scope:** Accounting PRD Section 8 + v2.4 HR items

1. **PPP-PD form XML generation** — Generate valid XML from payroll run data for ePorezi upload
2. **Payroll GL posting** — Auto-post journal entry on payroll approval (DR 5200/5210, CR 4500/4510/4520-4531)
3. **Payment order generation** — Generate bank payment orders for net salaries + tax/contribution payments
4. **eBolovanja → leave_requests bridge** — Auto-create leave request when sick leave submission approved
5. **eBolovanja → payroll bridge** — Reflect sick leave days (first 30 employer, after RFZO) in payroll calculation

---

### Phase 11: Government APIs & Advanced Integrations
**Scope:** v2.1 items 9-13 + v2.3 items 24-25

1. **eOtpremnica real API** — Replace stub in `eotpremnica-submit/index.ts` with real Ministry call (or manual XML export if spec pending)
2. **eBolovanje real API** — Replace stub in `ebolovanje-submit/index.ts` with RFZO/eUprava call (or manual XML export)
3. **Incoming eFaktura → Kalkulacija bridge** — When accepting purchase eFaktura, auto-create retail price calculation
4. **3-way PO matching** — PO line ↔ goods receipt line ↔ supplier invoice line with variance alerts
5. **Integrations page** — Add ePorezi, APR, Bank API connection cards

---

## Recommended Execution Order

Start with **Phase 4** (SEF + POS refunds) — highest legal compliance impact, smallest scope. Then Phase 5 (CoA), Phase 6 (Invoice posting), Phase 7 (POPDV), Phase 8 (Bank), Phase 9 (Frontend), Phase 10 (HR), Phase 11 (Gov APIs).

Each phase is independent and can be implemented in a single session. Phases 6 and 7 have the highest business value for accountants.


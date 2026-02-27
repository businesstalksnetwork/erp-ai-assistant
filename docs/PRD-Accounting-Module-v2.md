# PRD: Accounting Module Restructuring & Full Implementation

**Version:** 2.0
**Date:** 2026-02-27
**Status:** Draft
**Author:** AI-assisted based on accountant review + competitor analysis
**Competitors Benchmarked:** BizniSoft, Minimax (Seyfor/SAOP), Pantheon ERP (Datalab)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Accountant Review - Issues Found](#2-accountant-review---issues-found)
3. [Competitor Feature Matrix](#3-competitor-feature-matrix)
4. [Chart of Accounts (Kontni Plan)](#4-chart-of-accounts-kontni-plan)
5. [Invoice Management (Fakturisanje)](#5-invoice-management-fakturisanje)
6. [Bank Statements (Izvodi)](#6-bank-statements-izvodi)
7. [Journal Entries (Nalozi za knjizenje)](#7-journal-entries-nalozi-za-knjizenje)
8. [Payroll (Obracun Zarada)](#8-payroll-obracun-zarada)
9. [VAT & POPDV Management](#9-vat--popdv-management)
10. [eFaktura / SEF Integration](#10-efaktura--sef-integration)
11. [Fixed Assets (Osnovna Sredstva)](#11-fixed-assets-osnovna-sredstva)
12. [Cash Register (Blagajna)](#12-cash-register-blagajna)
13. [Reporting Module (Izvestaji)](#13-reporting-module-izvestaji)
14. [Supplier Invoices (Ulazne Fakture)](#14-supplier-invoices-ulazne-fakture)
15. [Open Items & Reconciliation](#15-open-items--reconciliation)
16. [Year-End Closing](#16-year-end-closing)
17. [Serbian Accounting Law AI Agent](#17-serbian-accounting-law-ai-agent)
18. [Database Schema Changes](#18-database-schema-changes)
19. [Implementation Phases](#19-implementation-phases)
20. [Acceptance Criteria](#20-acceptance-criteria)

---

## 1. Executive Summary

### Problem Statement

An independent accountant review revealed critical gaps in the accounting module. Core functionality - including chart of accounts analytics, invoice creation workflow, bank statement imports, journal entry posting, and payroll - is either incomplete, disconnected, or not functioning. The module does not match the professional-grade usability standards set by established Serbian accounting software (BizniSoft, Minimax, Pantheon ERP).

### Goal

Restructure and fully implement the accounting module to achieve **feature parity** with BizniSoft, Minimax, and Pantheon ERP, while leveraging AI capabilities as a competitive differentiator. The system must fully comply with Serbian accounting law, support all mandatory forms (POPDV, PP-PDV, PDP, PPP-PD), integrate with SEF (eFaktura), ePorezi, and APR, and provide a professional accounting workflow from document entry to financial statements.

### Key Principles

1. **Serbian Law First** - Every feature must comply with the Serbian Law on Accounting, VAT Law, and Labor Law
2. **Accountant-Centric UX** - Design for professional accountants, not casual users (keyboard-first, fast data entry, batch operations)
3. **Full Posting Chain** - Every document must be postable to the General Ledger with proper automatic posting templates
4. **Zero Data Re-entry** - Subsidiary ledgers fully integrated with GL (like Pantheon)
5. **AI-Enhanced, Not AI-Dependent** - AI assists but accountant always has full manual control

---

## 2. Accountant Review - Issues Found

### Critical Issues (Must Fix)

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | **Kontni Plan** | No analytics (analitika) per account - cannot track by partner, employee, object, etc. | CRITICAL |
| 2 | **Kontni Plan** | No foreign currency (devizni) flag per account | CRITICAL |
| 3 | **Invoice Creation** | Voucher type field is misplaced - should be optional/hidden | HIGH |
| 4 | **Invoice Creation** | "Choose legal entity" is redundant when firm is known | HIGH |
| 5 | **Invoice Creation** | Manual partner entry doesn't navigate to client database for full data entry | HIGH |
| 6 | **Invoice Creation** | No distinction between service, goods, or product on line items (affects posting rules) | CRITICAL |
| 7 | **Invoice Creation** | No POPDV field mapping | CRITICAL |
| 8 | **Invoice Creation** | No eFaktura category field | CRITICAL |
| 9 | **Invoice Creation** | No link to advance invoice on final invoice | HIGH |
| 10 | **Invoice Creation** | Cannot post/book invoice - only send - cannot verify posting correctness | CRITICAL |
| 11 | **Bank Statements** | Statement number not auto-generated with proper logic (e.g., iz265-1) | HIGH |
| 12 | **Bank Statements** | XML import not working | CRITICAL |
| 13 | **Bank Statements** | PDF import not working | HIGH |
| 14 | **Journal Entries** | Allows accounts with fewer than 4 digits (must enforce >= 4 digits) | HIGH |
| 15 | **Journal Entries** | Missing accounts in the system (e.g., 4350, 4360) | CRITICAL |
| 16 | **Journal Entries** | No search bar for account lookup | HIGH |
| 17 | **Journal Entries** | Analytics not pulled from chart of accounts | CRITICAL |
| 18 | **Journal Entries** | Accounts stop appearing after 433x range | CRITICAL |
| 19 | **Journal Entries** | Cannot post/book the entered journal entry | CRITICAL |
| 20 | **Payroll** | Nothing works - cannot test any payroll functionality | CRITICAL |

---

## 3. Competitor Feature Matrix

### Feature Comparison: BizniSoft vs Minimax vs Pantheon vs Our System

| Feature | BizniSoft | Minimax | Pantheon | Our System (Current) | Our System (Target) |
|---------|-----------|---------|----------|---------------------|---------------------|
| **Chart of Accounts** | | | | | |
| Standard Serbian kontni okvir | Yes | Yes | Yes | Partial | Yes |
| Account analytics (partner, employee, object, other) | Yes | Yes | Yes | No | Yes |
| Foreign currency flag per account | Yes | Yes | Yes | No | Yes |
| Cost center (mesto troskova) per account | Yes | Yes | Yes | No | Yes |
| Cost bearer (nosioci troskova) per account | Yes | Yes | Yes | No | Yes |
| Account closing flag (zatvaranje) | Yes | N/A | Yes | No | Yes |
| Hierarchical tree structure | Yes | Yes | Yes | Yes | Yes |
| Import from standard templates | Yes | Yes | Yes | Yes | Yes |
| **Invoicing** | | | | | |
| Konacna faktura (Final invoice) | Yes | Yes | Yes | Yes | Yes |
| Avansna faktura (Advance invoice) | Yes | Yes | Yes | Yes | Yes |
| Predracun / Profaktura (Proforma) | Yes | Yes | Yes | No | Yes |
| Knjizno odobrenje (Credit note) | Yes | Yes | Yes | No | Yes |
| Knjizno zaduzenje (Debit note) | Yes | Yes | Yes | No | Yes |
| Item type: Goods / Service / Product | Yes | Yes | Yes | No | Yes |
| POPDV field mapping per line | Yes | Yes | Yes | No | Yes |
| eFaktura category | Yes | Yes | Yes | No | Yes |
| Link to advance invoice | Yes | Yes | Yes | Partial | Yes |
| Automatic posting to GL | Yes | Yes | Yes | Partial | Yes |
| Post preview before sending | Yes | Yes | Yes | No | Yes |
| SEF integration | Yes | Yes | Yes | Yes | Yes |
| Partner lookup from database | Yes | Yes | Yes | Partial | Yes |
| APR auto-fetch partner data | Yes | N/A | N/A | No | Yes |
| Recurring invoices | Yes | Yes | Yes | Yes | Yes |
| **Bank Statements** | | | | | |
| Auto statement numbering (e.g., iz265-1) | Yes | Yes | Yes | No | Yes |
| XML import (NBS / bank format) | Yes | Yes | Yes | Broken | Yes |
| PDF import with OCR | N/A | N/A | N/A | Broken | Yes (AI) |
| CSV import | Yes | Yes | Yes | Yes | Yes |
| Auto-matching to invoices | Yes | Yes | Yes | Partial | Yes |
| Auto-posting matched items | Yes | Yes | Yes | Partial | Yes |
| Manual posting per line | Yes | Yes | Yes | No | Yes |
| Payment model recognition | Yes | N/A | Yes | Partial | Yes |
| **Journal Entries** | | | | | |
| Multiple voucher types | Yes | Yes | Yes | Partial | Yes |
| Min 4-digit account enforcement | Yes | Yes | Yes | No | Yes |
| Account search with autocomplete | Yes | Yes | Yes | No | Yes |
| Analytics selection per line | Yes | Yes | Yes | No | Yes |
| Cost center per line | Yes | Yes | Yes | Partial | Yes |
| Debit = Credit validation | Yes | Yes | Yes | Yes | Yes |
| Post / Book journal entry | Yes | Yes | Yes | Broken | Yes |
| Storno / Reversal | Yes | Yes | Yes | Yes | Yes |
| Opening balance entry type | Yes | Yes | Yes | No | Yes |
| **Payroll** | | | | | |
| Employee register | Yes | Yes | Yes | Partial | Yes |
| Salary agreement per employee | Yes | Yes | Yes | Partial | Yes |
| Monthly payroll calculation | Yes | Yes | Yes | Broken | Yes |
| Serbian tax rules (PIO, health, unemployment) | Yes | Yes | Yes | Schema only | Yes |
| Configurable rates with effective dates | Yes | Yes | Yes | Schema only | Yes |
| Non-taxable amount (neoporezivi iznos) | Yes | Yes | Yes | Schema only | Yes |
| PPP-PD form generation | Yes | Yes | Yes | No | Yes |
| XML export for ePorezi | Yes | Yes | Yes | No | Yes |
| Payment order generation | Yes | Yes | Yes | No | Yes |
| Payslip generation | Yes | Yes | Yes | No | Yes |
| GL posting of payroll | Yes | Yes | Yes | No | Yes |
| Other personal income (ugovor o delu, etc.) | Yes | Yes | Yes | No | Yes |
| Sick leave calculation | Yes | Yes | Yes | No | Yes |
| **VAT / POPDV** | | | | | |
| Automatic POPDV form generation | Yes | Yes | Yes | No | Yes |
| All 11 POPDV sections | Yes | Yes | Yes | No | Yes |
| PP-PDV form generation | Yes | Yes | Yes | No | Yes |
| XML export to ePorezi | Yes | Yes | Yes | No | Yes |
| Tax period locking | Yes | Yes | Yes | Partial | Yes |
| **Fixed Assets** | | | | | |
| Asset register | Yes | Yes | Yes | Schema only | Yes |
| Depreciation methods (straight-line, declining) | Yes | Yes | Yes | Schema only | Yes |
| Monthly depreciation posting | Yes | Yes | Yes | Schema only | Yes |
| Asset disposal / write-off | Yes | Yes | Yes | Schema only | Yes |
| **Reports** | | | | | |
| Trial Balance (Bruto bilans) | Yes | Yes | Yes | Yes | Yes |
| Balance Sheet (Bilans stanja) | Yes | Yes | Yes | Yes | Yes |
| Income Statement (Bilans uspeha) | Yes | Yes | Yes | Yes | Yes |
| General Ledger card | Yes | Yes | Yes | Yes | Yes |
| Partner card (IOS) | Yes | Yes | Yes | Partial | Yes |
| Cost center P&L | Yes | Yes | Yes | Partial | Yes |
| Cash flow statement | Yes | Yes | Yes | No | Yes |
| Comparative period reports | Yes | Yes | Yes | Yes | Yes |
| KPO book | Yes | N/A | N/A | Partial | Yes |

---

## 4. Chart of Accounts (Kontni Plan)

### 4.1 Current State

The chart of accounts exists with basic fields: code, name, name_sr, account_type, parent_id, level, is_active, is_system. Missing critical fields for analytics, currency tracking, cost centers, and closing behavior.

### 4.2 Required Changes

#### 4.2.1 Account Analytics (Analitika)

Every account must support optional analytics tracking. Analytics define what sub-ledger the account is tied to.

**Analytics Types:**
| Type | Description | Example Accounts |
|------|-------------|-----------------|
| `PARTNER` | Track by business partner (kupci/dobavljaci) | 2020, 2040, 4320, 4330 |
| `EMPLOYEE` | Track by employee | 4500, 4510, 4520 |
| `OBJECT` | Track by object/project/asset | 0230, 0240, 0270 |
| `COST_CENTER` | Track by cost center | Any expense/revenue account |
| `NONE` | No sub-analytics | Most summary accounts |

**New fields on `chart_of_accounts` table:**

```
analytics_type: ENUM('NONE', 'PARTNER', 'EMPLOYEE', 'OBJECT', 'COST_CENTER') DEFAULT 'NONE'
is_foreign_currency: BOOLEAN DEFAULT false
tracks_cost_center: BOOLEAN DEFAULT false
tracks_cost_bearer: BOOLEAN DEFAULT false
is_closing_account: BOOLEAN DEFAULT false  -- used in year-end close (classes 4, 7)
min_digits: INTEGER DEFAULT 4  -- minimum digits for posting (enforce >= 4)
```

#### 4.2.2 Account Validation Rules

- Account code must be >= 4 digits for posting (like BizniSoft)
- Parent/synthetic accounts (< 4 digits) are for grouping only, never for direct posting
- When analytics_type is set, journal entry lines MUST provide the corresponding analytics reference
- When is_foreign_currency = true, journal lines must include currency and foreign amount

#### 4.2.3 Full Serbian Kontni Okvir Pre-loaded

Load the complete Serbian chart of accounts framework (Kontni okvir) per the Pravilnik:

| Class | Name (SR) | Name (EN) |
|-------|-----------|-----------|
| 0 | Upisani a neuplaceni kapital i stalna imovina | Subscribed unpaid capital & non-current assets |
| 1 | Zalihe i stalna sredstva namenjena prodaji | Inventories & trading assets |
| 2 | Kratkorocna potrazivanja, plasmani i gotovina | Short-term receivables, investments & cash |
| 3 | Kapital | Capital & reserves |
| 4 | Dugorocna rezervisanja i obaveze | Long-term provisions & liabilities |
| 5 | Rashodi | Expenses |
| 6 | Prihodi | Income |
| 7 | Otvaranje i zakljucivanje racuna | Opening/closing accounts |
| 8 | Vanbilansna evidencija | Off-balance sheet records |
| 9 | Obracun troskova i ucinaka | Cost accounting |

Ensure ALL standard 4-digit accounts are loaded (especially those missing: 4350, 4360, and all accounts beyond the 433x range).

#### 4.2.4 UI Requirements

1. **Tree view** with expand/collapse by class → group → synthetic → analytical
2. **Search bar** with instant filtering by code or name (Serbian and English)
3. **Quick edit** - click account to edit analytics type, currency flag, etc.
4. **Bulk import** - upload full kontni plan from CSV/Excel with analytics mappings
5. **Account card** - click any account to see all GL entries, balances, turnover (like Pantheon's account card)
6. **Color coding** by analytics type for visual clarity

### 4.3 UI Mockup Reference

```
+-------------------------------------------------------------------+
| Kontni Plan                              [Search...] [+ Add] [Import] |
+-------------------------------------------------------------------+
| Code  | Name                | Analytics | Currency | Cost Center    |
|-------|---------------------|-----------|----------|----------------|
| ▼ 0   | Stalna imovina      |           |          |                |
|   ▼ 02 | Nekretnine, postrojenja | OBJECT |       |                |
|     0230 | Poslovni objekti    | OBJECT   |          | Yes            |
|     0240 | Masine i oprema     | OBJECT   |          | Yes            |
| ▼ 2   | Kratkorocna potrazivanja |       |          |                |
|   ▼ 20 | Kupci                |           |          |                |
|     2020 | Kupci u zemlji      | PARTNER  |          |                |
|     2030 | Kupci u inostranstvu | PARTNER | Yes (EUR)|                |
| ▼ 4   | Obaveze              |           |          |                |
|   ▼ 43 | Obaveze iz poslovanja|           |          |                |
|     4320 | Dobavljaci u zemlji | PARTNER  |          |                |
|     4330 | Dobavljaci inostranstvo | PARTNER | Yes  |                |
|     4350 | Obaveze za PDV      | NONE     |          |                |
|     4360 | Obaveze za porez    | NONE     |          |                |
+-------------------------------------------------------------------+
```

---

## 5. Invoice Management (Fakturisanje)

### 5.1 Invoice Types

The system must support these separate invoice types, each as a distinct workflow:

| Type | Serbian Name | Description |
|------|-------------|-------------|
| `FINAL` | Konacna faktura | Standard sales invoice |
| `ADVANCE` | Avansna faktura | Advance payment invoice |
| `ADVANCE_FINAL` | Konacna po avansnoj | Final invoice referencing advance |
| `PROFORMA` | Predracun / Profaktura | Proforma invoice (no GL posting) |
| `CREDIT_NOTE` | Knjizno odobrenje | Credit note (reduces receivable) |
| `DEBIT_NOTE` | Knjizno zaduzenje | Debit note (increases receivable) |

**Recommendation:** Each type should be accessible from separate menu items or a clear type selector at the top of the form (not buried in a dropdown like voucher type).

### 5.2 Invoice Creation Flow (Redesigned)

#### Step 1: Header

```
+-------------------------------------------------------------------+
| Nova Faktura                                                        |
+-------------------------------------------------------------------+
| Tip: [Konacna] [Avansna] [Predracun] [Kn.Odobrenje] [Kn.Zaduzenje] |
+-------------------------------------------------------------------+
| Broj fakture: [auto]        Datum: [27.02.2026]                     |
| Datum valute: [29.03.2026]  Mesto izdavanja: [Beograd]              |
|                                                                     |
| PARTNER                                                             |
| [Search partner...] ili [+ Novi partner →]                          |
| (clicking "Novi partner" opens partner form in side panel)          |
|                                                                     |
| Naziv: Firma DOO            PIB: 123456789                         |
| Adresa: Ulica 1, Beograd    MB: 12345678                           |
| Tekuci racun: 170-123456-78                                        |
|                                                                     |
| Valuta: [RSD ▼]  Kurs: [1.0000]                                   |
| Prodavac: [Select ▼]                                               |
|                                                                     |
| Avansni racun (za konacnu): [Select previous advance invoice ▼]    |
+-------------------------------------------------------------------+
```

**Key changes from current:**
- Remove "Tip vaucera" from this screen (move to settings)
- Remove "Izaberi pravno lice" if only one legal entity exists (auto-select)
- Partner search opens full partner database with all fields
- "+ Novi partner" opens partner form in side panel (not a modal), pre-populated with APR data lookup by PIB
- Advance invoice link is visible only for ADVANCE_FINAL type

#### Step 2: Line Items

```
+-------------------------------------------------------------------+
| STAVKE FAKTURE                                                      |
+-------------------------------------------------------------------+
| # | Vrsta | Artikal/Opis      | Kol | JM  | Cena | PDV  | POPDV | eFakt.kat | Ukupno |
|---|-------|--------------------|-----|-----|------|------|-------|-----------|--------|
| 1 | Roba  | Widget A           | 10  | kom | 1000 | 20%  | 3.2   | S         | 12000  |
| 2 | Usluga| Konsalting usluga  | 8   | h   | 5000 | 20%  | 3.2   | S         | 48000  |
| 3 | Proizvod| Proizvod X       | 5   | kom | 2000 | 10%  | 3.2   | S         | 11000  |
+-------------------------------------------------------------------+
| Vrsta stavke: [Roba ▼] [Usluga ▼] [Proizvod ▼]                    |
+-------------------------------------------------------------------+
```

**Critical new fields per line:**

| Field | Description | Required |
|-------|-------------|----------|
| `item_type` | GOODS / SERVICE / PRODUCT - affects GL posting | Yes |
| `popdv_field` | POPDV form field mapping (e.g., 3.2, 3.4, 1.1) | Yes |
| `efaktura_category` | eFaktura tax category code (S, AE, E, Z, O, etc.) | Yes |
| `warehouse_id` | Only for GOODS/PRODUCT - which warehouse to debit | Conditional |

**Item type impacts:**
- **Roba (Goods):** Debits 5000 (Nabavna vrednost prodate robe), Credits 1320 (Roba u magacinu) + Revenue posting
- **Usluga (Service):** Direct revenue posting, no inventory impact
- **Proizvod (Product):** Debits 5100 (Cena kostanja gotovih proizvoda), Credits 1200 (Gotovi proizvodi) + Revenue posting

#### Step 3: Totals & POPDV Summary

```
+-------------------------------------------------------------------+
| PREGLED                                                             |
+-------------------------------------------------------------------+
| Osnovica (20%):     50,000.00 RSD    PDV (20%):    10,000.00 RSD  |
| Osnovica (10%):     10,000.00 RSD    PDV (10%):     1,000.00 RSD  |
| --------------------------------------------------------           |
| Ukupna osnovica:    60,000.00 RSD                                  |
| Ukupan PDV:         11,000.00 RSD                                  |
| UKUPNO ZA UPLATU:   71,000.00 RSD                                  |
|                                                                     |
| POPDV Raspored:                                                    |
| Polje 3.2: Osnovica: 60,000 | PDV: 11,000                        |
+-------------------------------------------------------------------+
```

#### Step 4: Post Preview (NEW - Critical)

Before sending or saving, the accountant MUST be able to preview the GL posting:

```
+-------------------------------------------------------------------+
| PREGLED KNJIZENJA (Preview)                                        |
+-------------------------------------------------------------------+
| R.B | Konto | Naziv konta              | Duguje    | Potrazuje  |
|-----|-------|--------------------------|-----------|------------|
| 1   | 2020  | Kupci u zemlji           | 71,000.00 |            |
| 2   | 6000  | Prihodi od prodaje robe  |           | 50,000.00  |
| 3   | 6120  | Prihodi od usluga       |           | 10,000.00  |
| 4   | 4350  | Obaveze za PDV - izlazni |          | 11,000.00  |
+-------------------------------------------------------------------+
| [Proknjizi i Posalji]  [Sacuvaj kao nacrt]  [Odustani]             |
+-------------------------------------------------------------------+
```

**This is the #1 missing feature.** The accountant must see the exact journal entry BEFORE it is created, and approve or modify it.

#### Step 5: Actions After Posting

- **Sacuvaj kao nacrt** (Save as draft) - saves without posting
- **Proknjizi** (Post) - creates journal entry, marks invoice as posted
- **Proknjizi i posalji na SEF** (Post & send to SEF) - posts and submits to eFaktura
- **Stampaj** (Print) - generates PDF with all legal requirements
- **Posalji emailom** (Send by email) - sends PDF to partner

### 5.3 Posting Rules Per Item Type

The system must use different GL accounts based on item_type:

| Item Type | Debit Account | Credit Account | COGS Account |
|-----------|--------------|----------------|--------------|
| GOODS | 2020 (Kupci) | 6000 (Prihod od robe) | 5000/1320 |
| SERVICE | 2020 (Kupci) | 6120 (Prihod od usluga) | N/A |
| PRODUCT | 2020 (Kupci) | 6100 (Prihod od proizvoda) | 5100/1200 |

PDV is always posted to 4350 (PDV obaveze - izlazni).

---

## 6. Bank Statements (Izvodi)

### 6.1 Statement Numbering

Auto-generate statement number using the format: `iz{bank_account_last3}-{sequential_number}`

Example: For bank account 170-0001234567-89
- First statement: `iz567-1`
- Second statement: `iz567-2`

The sequential number resets per fiscal year.

### 6.2 Import Formats

| Format | Status (Current) | Target | Parser |
|--------|-----------------|--------|--------|
| XML (NBS standard) | Broken | Working | Parse standard Serbian bank XML format |
| CSV (bank-specific) | Working | Enhanced | Support multiple bank CSV formats |
| PDF (scan/digital) | Broken | AI-powered | OCR + AI extraction |
| MT940 (SWIFT) | N/A | New | International bank statement format |

#### XML Import (Priority Fix)

Serbian banks export statements in a standard XML format. The parser must handle:
- Statement header: bank account, date, opening/closing balance, statement number
- Statement lines: date, description, amount, direction (credit/debit), partner name, partner account, payment reference (poziv na broj), payment purpose code (sifra placanja)

#### PDF Import (AI-Enhanced)

Use the existing AI infrastructure to:
1. OCR the PDF to extract text
2. AI parses the text into structured statement lines
3. Present extracted data for user review/correction before import

### 6.3 Statement Processing Workflow

```
Import → Review Lines → Match to Invoices → Select Payment Model → Preview GL Posting → Post
```

#### Per-Line Processing

Each bank statement line must support:

1. **Auto-matching** - Match to open invoices by payment reference (poziv na broj)
2. **Payment model selection** - Select from predefined models:
   - CUSTOMER_PAYMENT (Uplata kupca)
   - VENDOR_PAYMENT (Placanje dobavljacu)
   - ADVANCE_RECEIVED (Primljeni avans)
   - ADVANCE_PAID (Dati avans)
   - SALARY_PAYMENT (Isplata zarada)
   - TAX_PAYMENT (Placanje poreza)
   - VAT_PAYMENT (Placanje PDV)
   - BANK_FEE (Bankarska provizija)
   - INTER_ACCOUNT_TRANSFER (Interni prenos)
   - FX_REVALUATION (Kursna razlika)
   - INTERNAL_COMPENSATION (Kompenzacija)
   - CUSTOMER_REFUND (Povrat kupcu)
   - VENDOR_REFUND (Povrat od dobavljaca)
3. **Analytics entry** - Select partner/employee/object per account analytics requirement
4. **GL preview** - Show what will be posted before committing
5. **Batch posting** - Post all matched/configured lines at once

### 6.4 UI Requirements

```
+-------------------------------------------------------------------+
| Izvod: iz567-1          Datum: 27.02.2026                          |
| Banka: Intesa           Racun: 170-0001234567-89                   |
| Pocetno stanje: 1,250,000.00   Krajnje stanje: 1,380,000.00      |
+-------------------------------------------------------------------+
| # | Datum | Opis           | Partner      | Iznos    | Sm | Model    | Match        | Status  |
|---|-------|----------------|--------------|----------|----| ---------|-------------|---------|
| 1 | 27.02 | Uplata po fakt | Firma DOO    | +50,000  | IN | CUSTOMER | Fakt #123 ✓ | Matched |
| 2 | 27.02 | Provizija      |              | -500     | OUT| BANK_FEE | Auto        | Posted  |
| 3 | 27.02 | Plata februar  | Zaposleni    | -350,000 | OUT| SALARY   | (multiple)  | Pending |
| 4 | 27.02 | Nepoznata upl  | ???          | +30,000  | IN | ???      |             | Unmatched|
+-------------------------------------------------------------------+
| [Post All Matched] [AI Suggest Unmatched] [Export]                 |
+-------------------------------------------------------------------+
```

---

## 7. Journal Entries (Nalozi za knjizenje)

### 7.1 Voucher Types (Tipovi naloga)

Following BizniSoft's approach, support these voucher types:

| Code | Name (SR) | Name (EN) | Auto/Manual |
|------|-----------|-----------|-------------|
| ON | Ostali nalozi | Other vouchers | Manual |
| IB | Izvodi banaka | Bank statements | Auto from import |
| KL | Kalkulacije | Purchase calculations | Auto from purchase |
| DP | Dnevni pazari | Daily POS sales | Auto from POS |
| IF | Izlazne fakture | Sales invoices | Auto from invoicing |
| UF | Ulazne fakture | Purchase invoices | Auto from supplier invoicing |
| NT | Nalozi troskova | Cost orders | Manual |
| NV | Nivelacije | Price adjustments | Auto from inventory |
| IR | Interni racuni | Internal invoices | Manual |
| AF | Avansni racuni | Advance invoices | Auto from invoicing |
| OS | Osnovna sredstva | Fixed assets | Auto from depreciation |
| KN | Kasa nalozi | Cash desk vouchers | Auto from cash register |
| PL | Popisne liste | Inventory lists | Auto from stocktake |
| PS | Pocetno stanje | Opening balance | Manual (year start) |
| BL | Blagajne | Petty cash | Auto from cash register |

### 7.2 Journal Entry Form (Redesigned)

```
+-------------------------------------------------------------------+
| Novi Nalog za Knjizenje                                             |
+-------------------------------------------------------------------+
| Tip naloga: [ON - Ostali nalozi ▼]                                 |
| Broj naloga: [auto]          Datum: [27.02.2026]                   |
| Opis: [Opis knjizenja...]                                         |
| Referenca: [...]              Fiskalni period: [Feb 2026]          |
+-------------------------------------------------------------------+
| STAVKE NALOGA                                                       |
+-------------------------------------------------------------------+
| # | Konto  | Naziv konta         | Analitika        | Duguje   | Potrazuje | MestoTr |
|---|--------|---------------------|------------------|----------|-----------|---------|
| 1 | [5120▼]| Troskovi energije   |                  | 15,000   |           | [IT ▼]  |
| 2 | [2700▼]| PDV u primljenim    |                  | 3,000    |           |         |
| 3 | [4320▼]| Dobavljaci u zemlji | [EPS DOO ▼]      |          | 18,000    |         |
+-------------------------------------------------------------------+
|                                     UKUPNO: | 18,000   | 18,000    |         |
+-------------------------------------------------------------------+
| [Proknjizi]  [Sacuvaj nacrt]  [Odustani]                           |
+-------------------------------------------------------------------+
```

### 7.3 Validation Rules

1. **Account code >= 4 digits** - Do not allow posting to synthetic accounts
2. **Debit = Credit** - Total debits must equal total credits
3. **Analytics required** - If account has analytics_type != NONE, the analytics reference is mandatory
4. **Foreign currency** - If account has is_foreign_currency = true, require currency code and foreign amount
5. **Fiscal period open** - Cannot post to closed/locked fiscal period
6. **Account active** - Only active accounts can receive postings
7. **All accounts loaded** - Ensure all standard Serbian accounts are in the system

### 7.4 Account Search (Critical UX)

The account selector must have:
- **Instant search** by code or name (Serbian/English)
- **Typeahead** - typing "432" shows 4320, 4321, 4322, etc.
- **Recent accounts** - show last 10 used accounts
- **Favorites** - allow starring frequently used accounts
- **Full list** with scroll and filter by class
- **Keyboard navigation** - Tab to move between fields, Enter to select

### 7.5 Posting Flow

1. **Draft** - Save without posting (can still edit)
2. **Post** - Validate all rules → create journal entry → update GL balances → lock entry
3. **Storno** - Create reverse entry (not delete) → linked to original

---

## 8. Payroll (Obracun Zarada)

### 8.1 Current State

Schema exists but nothing is functional. Complete implementation required.

### 8.2 Employee Register (Maticna Knjiga Radnika)

Required employee fields:

| Field | Description |
|-------|-------------|
| Ime i prezime | Full name |
| JMBG | Unique citizen ID number |
| Broj licne karte | ID card number |
| Adresa | Address |
| Opstina stanovanja | Municipality (for surtax - prirez) |
| Strucna sprema | Education level |
| Radno mesto | Job position |
| Datum zaposlenja | Employment start date |
| Tip ugovora | Contract type (neodredjeno / odredjeno / probni) |
| Radno vreme | Working hours (full / part time + hours) |
| Bruto zarada | Agreed gross salary |
| Tekuci racun | Bank account for salary payment |
| Banka | Bank name |
| Krediti i obustave | Loans and deductions |
| Minuli rad | Years of service bonus % |
| Poreske olaksice | Tax reliefs (if applicable) |

### 8.3 Payroll Calculation (Serbian Rules)

#### Standard Payroll Formula (2025/2026):

```
BRUTO ZARADA (Gross Salary)
├── Doprinosi na teret zaposlenog (Employee contributions):
│   ├── PIO: 14% × Bruto
│   ├── Zdravstvo: 5.15% × Bruto
│   └── Nezaposlenost: 0.75% × Bruto
│   = Ukupno doprinosi zaposleni: 19.9% × Bruto
│
├── Poreska osnovica = Bruto - Doprinosi zaposleni - Neoporezivi iznos (25,000 RSD*)
│
├── Porez na dohodak = 10% × Poreska osnovica
│
├── NETO ZARADA = Bruto - Doprinosi zaposleni - Porez
│
└── Doprinosi na teret poslodavca (Employer contributions):
    ├── PIO: 10% × Bruto
    └── Zdravstvo: 5.15% × Bruto
    = Ukupno doprinosi poslodavac: 15.15% × Bruto

UKUPAN TROSAK POSLODAVCA = Bruto + Doprinosi poslodavac
```

*Note: The non-taxable amount (neoporezivi iznos) changes periodically - must be configurable via payroll_parameters table with effective dates.

#### Configurable Parameters (payroll_parameters table):

| Parameter | Current Value | Effective From |
|-----------|--------------|----------------|
| nontaxable_amount | 25,000 RSD | 2025-01-01 |
| employee_pio_rate | 14% | 2025-01-01 |
| employee_health_rate | 5.15% | 2025-01-01 |
| employee_unemployment_rate | 0.75% | 2025-01-01 |
| employer_pio_rate | 10% | 2025-01-01 |
| employer_health_rate | 5.15% | 2025-01-01 |
| tax_rate | 10% | 2025-01-01 |
| min_contribution_base | (varies) | 2025-01-01 |
| max_contribution_base | (varies) | 2025-01-01 |

### 8.4 Payroll Workflow

```
1. Otvori obracun (Open payroll run for month/year)
2. Preuzmi zaposlene (Load employees from register)
3. Unesi sate (Enter hours: regular, overtime, holiday, sick leave)
4. Obracunaj (Calculate: apply formulas per employee)
5. Pregled (Review: check each employee's breakdown)
6. Formiranje PPP-PD (Generate PPP-PD form)
7. Proknjizi (Post to GL)
8. Formiranje naloga za placanje (Generate payment orders)
9. Odobri (Approve)
10. Isplati (Mark as paid)
```

### 8.5 GL Posting for Payroll

| # | Account | Description | Debit | Credit |
|---|---------|-------------|-------|--------|
| 1 | 5200 | Troskovi bruto zarada | Gross | |
| 2 | 5210 | Doprinosi poslodavca | Employer contrib | |
| 3 | 4500 | Obaveze za neto zarade | | Net salary |
| 4 | 4510 | Obaveze za porez na zarade | | Income tax |
| 5 | 4520 | Obaveze za doprinose - PIO zaposleni | | Employee PIO |
| 6 | 4521 | Obaveze za doprinose - Zdravstvo zaposleni | | Employee health |
| 7 | 4522 | Obaveze za doprinose - Nezaposlenost | | Employee unemployment |
| 8 | 4530 | Obaveze za doprinose - PIO poslodavac | | Employer PIO |
| 9 | 4531 | Obaveze za doprinose - Zdravstvo poslodavac | | Employer health |

### 8.6 PPP-PD Form Generation

The system must generate the PPP-PD (Pojedinacna Poreska Prijava o obracunatim porezima i doprinosima) form in XML format for upload to ePorezi portal. Fields include:
- Employee data (JMBG, name, municipality)
- Income type code (OVP)
- Gross amount
- Contribution base
- Individual tax and contribution amounts
- Payment date
- Period

### 8.7 Other Personal Income Types

Beyond standard employment, support:
- Ugovor o delu (Service contract)
- Ugovor o privremenim i povremenim poslovima (Temporary work)
- Autorski honorar (Authorship fee)
- Zakup (Rental income)
- Dividende (Dividends)

Each has different tax rates and contribution rules.

---

## 9. VAT & POPDV Management

### 9.1 POPDV Form Structure

The system must automatically generate the POPDV form from posted GL entries and invoice data. The form has 11 sections:

| Section | Description (SR) | Description (EN) |
|---------|------------------|-------------------|
| 1 | Promet sa pravom na odbitak prethodnog PDV | VAT-exempt supply WITH right to deduct input VAT |
| 1.1 | Izvoz dobara | Export of goods |
| 1.2 | Promet u slobodnim zonama | Supply in free zones |
| 1.3 | Prevozne i ostale usluge u vezi sa izvozom | Transport services related to export |
| 1.4 | Ostali promet sa pravom na odbitak | Other exempt supply with deduction right |
| 1.5 | Ukupan promet (1.1 do 1.4) | Total supply (sum) |
| 2 | Promet bez prava na odbitak prethodnog PDV | VAT-exempt supply WITHOUT right to deduct |
| 2.1-2.4 | Various exempt categories (banking, insurance, etc.) | |
| 2.5 | Ukupan promet (2.1 do 2.4) | Total |
| 3 | Oporezivi promet i obracunati PDV | Taxable supply and calculated VAT |
| 3.1 | Po opstoj stopi (20%) - osnovica | General rate (20%) - base |
| 3.2 | Po opstoj stopi (20%) - PDV | General rate (20%) - VAT |
| 3.3 | Po sniženoj stopi (10%) - osnovica | Reduced rate (10%) - base |
| 3.4 | Po sniženoj stopi (10%) - PDV | Reduced rate (10%) - VAT |
| 3.5-3.9 | Increases/decreases, supplies without consideration, advances | |
| 3a | Interni obracun PDV (reverse charge) | Internal VAT calculation (reverse charge) |
| 4 | Posebni postupci oporezivanja | Special taxation procedures |
| 5 | Ukupan promet i ukupan PDV | Total supply and total VAT (summary) |
| 6 | Uvoz dobara | Import of goods |
| 7 | Nabavka od poljoprivrednika | Purchase from farmers |
| 8 | Nabavka dobara i usluga | Purchase of goods and services |
| 8a | Od obveznika PDV (dobavljac duguje) | From VAT payers (supplier is debtor) |
| 8b | Interni obracun (primalac duguje) | Internal calculation (recipient is debtor) |
| 8v | Od lica koja nemaju obavezu obracuna PDV | From non-VAT obligated entities |
| 8g | Od stranih lica | From foreign entities |
| 8d | Ostale nabavke | Other purchases |
| 8e | Prethodni PDV za odbitak | Input VAT for deduction |
| 9 | Ukupna nabavka (sa uvozom) | Total purchases (including imports) |
| 9a | Prethodni PDV u poreskoj prijavi | Input VAT in tax return |
| 10 | Poreska obaveza (izlazni - ulazni PDV) | Tax obligation (output - input VAT) |
| 11 | Promet u inostranstvu i ostali promet | Supply abroad and other non-VAT supply |

### 9.2 POPDV Field Mapping

Every sales and purchase transaction must map to a POPDV field. This mapping comes from:
1. **Invoice line** - Each line has a `popdv_field` assignment
2. **Supplier invoice line** - Same mapping for purchases
3. **Bank statement line** - For direct postings (e.g., import VAT)
4. **Journal entry line** - Manual entries with POPDV tag

### 9.3 Automatic POPDV Generation

```sql
-- Example: Collect all output VAT for field 3.2 (20% rate)
SELECT SUM(tax_amount) as pdv_20
FROM invoice_lines il
JOIN invoices i ON i.id = il.invoice_id
WHERE i.status = 'posted'
  AND i.invoice_date BETWEEN period_start AND period_end
  AND il.popdv_field = '3.2';
```

### 9.4 PP-PDV Form

The PP-PDV (Poreska prijava za PDV) form is generated from POPDV data:
- Field 005: Total output VAT
- Field 105: Total input VAT
- Field 110: Tax obligation (005 - 105)

Must support XML export for ePorezi portal submission.

### 9.5 Important Note: POPDV Transition

> Starting from VAT period January 2026 (or Q1 2026), the POPDV form is being replaced by a preliminary (pre-filled) VAT return generated from SEF data. The system should support BOTH the traditional POPDV form and the new pre-filled VAT return workflow.

---

## 10. eFaktura / SEF Integration

### 10.1 Current State

Basic SEF integration exists for sending invoices. Needs enhancement.

### 10.2 Required eFaktura Categories

Every invoice line must have an eFaktura tax category:

| Code | Description | Serbian |
|------|-------------|---------|
| S | Standard rate | Standardna stopa (20% ili 10%) |
| AE | Reverse charge | Prenos poreske obaveze |
| E | Exempt from tax | Oslobodjeno PDV bez prava na odbitak |
| Z | Zero rated | Oslobodjeno PDV sa pravom na odbitak |
| O | Not subject to VAT | Nije predmet oporezivanja PDV |
| OE | Not subject to VAT (exempt) | Nije predmet oporezivanja PDV (oslobodjeno) |
| SS | Special procedures | Posebni postupci |

### 10.3 Two-Way Integration

- **Outbound:** Send invoices from our system to SEF
- **Inbound:** Receive and import invoices from SEF into supplier invoices
- **Status polling:** Track acceptance/rejection from SEF
- **CRF (Centralni Registar Faktura):** For invoices to public sector entities

### 10.4 Electronic Delivery Notes (New for 2026)

Starting January 2026, electronic delivery notes (otpremnice) are required for certain transactions. Plan for this:
- Delivery note creation linked to invoices
- Electronic submission workflow
- Tracking and status management

---

## 11. Fixed Assets (Osnovna Sredstva)

### 11.1 Asset Register

| Field | Description |
|-------|-------------|
| Inventarski broj | Inventory number (unique) |
| Naziv | Asset name |
| Opis | Description |
| Datum nabavke | Acquisition date |
| Nabavna vrednost | Acquisition cost |
| Amortizaciona grupa | Depreciation group (per Serbian law) |
| Stopa amortizacije | Depreciation rate |
| Metod | Straight-line / Declining balance |
| Koristan vek (meseci) | Useful life in months |
| Rezidualna vrednost | Salvage value |
| Lokacija | Location / Cost center |
| Konto nabavne vrednosti | GL account for acquisition cost |
| Konto ispravke vrednosti | GL account for accumulated depreciation |
| Konto amortizacije | GL account for depreciation expense |
| Status | Active / Disposed / Written off |

### 11.2 Monthly Depreciation Run

1. Select period (month/year)
2. Calculate depreciation for all active assets
3. Preview journal entries
4. Post batch journal entry
5. Update accumulated depreciation

### 11.3 Asset Operations

- **Nabavka (Acquisition):** Create asset from purchase invoice or manual entry
- **Amortizacija (Depreciation):** Monthly batch calculation and posting
- **Rashodovanje (Disposal):** Write off asset, post remaining value
- **Prodaja (Sale):** Sell asset, calculate gain/loss
- **Revalorizacija (Revaluation):** Annual revaluation per Serbian rules

---

## 12. Cash Register (Blagajna)

### 12.1 Cash Register Types

- **Dinarska blagajna** - RSD cash register
- **Devizna blagajna** - Foreign currency cash register

### 12.2 Documents

| Document | Description |
|----------|-------------|
| Nalog blagajni za uplatu | Cash receipt voucher |
| Nalog blagajni za isplatu | Cash disbursement voucher |
| Blagajnicki dnevnik | Daily cash journal |

### 12.3 Workflow

1. Create cash receipt/disbursement with partner, amount, description
2. Assign GL accounts (auto from templates)
3. Post to GL
4. Generate daily cash journal report
5. Reconcile with physical cash count

---

## 13. Reporting Module (Izvestaji)

### 13.1 Standard Reports

| Report | Serbian Name | Status | Priority |
|--------|-------------|--------|----------|
| Trial Balance | Bruto bilans | Exists | Enhance |
| Balance Sheet | Bilans stanja | Exists | Enhance |
| Income Statement | Bilans uspeha | Exists | Enhance |
| General Ledger Card | Kartica konta | Needs work | HIGH |
| Partner Card | Kartica partnera (IOS) | Partial | HIGH |
| Open Items Report | Otvorene stavke | Partial | HIGH |
| Aging Report | Starosna struktura | Exists | Maintain |
| Cash Flow Statement | Izvestaj o tokovima gotovine | Missing | HIGH |
| POPDV Form | POPDV obrazac | Missing | CRITICAL |
| PP-PDV Form | PP-PDV prijava | Missing | CRITICAL |
| PPP-PD Form | PPP-PD prijava | Missing | CRITICAL |
| PDP Form | PDP - Poreska prijava za porez na dobit | Partial | HIGH |
| KPO Book | KPO knjiga | Partial | MEDIUM |
| Daily Journal | Dnevnik knjizenja | Missing | HIGH |
| Cost Center P&L | P&L po mestu troska | Partial | MEDIUM |
| Comparative Reports | Uporedni izvestaji | Exists | Maintain |

### 13.2 Account Card (Kartica konta) - Critical

The account card is the most-used report in Serbian accounting. It shows all transactions for a specific GL account within a period:

```
+-------------------------------------------------------------------+
| Kartica konta: 2020 - Kupci u zemlji                               |
| Period: 01.01.2026 - 28.02.2026                                   |
+-------------------------------------------------------------------+
| Pocetno stanje:     Duguje: 150,000    Potrazuje: 0               |
+-------------------------------------------------------------------+
| Datum | Br.naloga | Opis            | Partner     | Duguje | Potr. | Saldo  |
|-------|-----------|-----------------|-------------|--------|-------|--------|
| 05.01 | IF-001    | Faktura #101    | Firma DOO   | 50,000 |       | 200,000|
| 12.01 | IB-001    | Uplata kupca    | Firma DOO   |        | 50,000| 150,000|
| 15.01 | IF-002    | Faktura #102    | Client LLC  | 30,000 |       | 180,000|
| 28.02 | IB-005    | Uplata kupca    | Client LLC  |        | 30,000| 150,000|
+-------------------------------------------------------------------+
| Promet:              Duguje: 80,000    Potrazuje: 80,000           |
| Krajnje stanje:      Duguje: 150,000   Potrazuje: 0               |
+-------------------------------------------------------------------+
```

Must support filtering by:
- Account range (from - to)
- Date range
- Partner
- Cost center
- Voucher type

### 13.3 Partner Card (IOS - Izvod Otvorenih Stavki)

Shows all open items for a specific partner across accounts (2020, 4320, etc.):
- Outstanding invoices
- Payments received/made
- Running balance
- Aging breakdown
- Used for IOS reconciliation confirmations with partners

---

## 14. Supplier Invoices (Ulazne Fakture)

### 14.1 Supplier Invoice Types

| Type | Description |
|------|-------------|
| STANDARD | Regular purchase invoice |
| ADVANCE | Advance payment invoice |
| CREDIT_NOTE | Credit note from supplier |
| IMPORT | Import invoice (with customs) |

### 14.2 Supplier Invoice Flow

```
Receive from SEF → Review → Enter additional data → Match to PO → Approve → Post to GL
```

### 14.3 Required Fields

| Field | Description |
|-------|-------------|
| Supplier (partner) | Selected from partner database |
| Invoice number (supplier's) | Supplier's invoice number |
| Invoice date | Date on supplier's invoice |
| Receipt date | Date we received it |
| Due date | Payment due date |
| Line items | With item type, POPDV field, amounts |
| VAT amounts | By rate (20%, 10%) |
| POPDV mapping | Fields 8a, 8b, 8g, etc. |
| eFaktura category | Tax category from SEF |
| Approval status | Pending → Approved → Posted |

### 14.4 GL Posting for Supplier Invoice

| # | Account | Description | Debit | Credit |
|---|---------|-------------|-------|--------|
| 1 | 5xxx | Expense account (per item type) | Net amount | |
| 2 | 2700 | Prethodni PDV (Input VAT) | VAT amount | |
| 3 | 4320 | Dobavljaci u zemlji | | Total |

For goods:
| 1 | 1320 | Roba u magacinu | Net amount | |
| 2 | 2700 | Prethodni PDV | VAT amount | |
| 3 | 4320 | Dobavljaci | | Total |

---

## 15. Open Items & Reconciliation

### 15.1 Open Items (Otvorene Stavke)

Track all unpaid invoices (both AR and AP):
- Document type, number, date
- Original amount, paid amount, remaining amount
- Aging bucket (0-30, 30-60, 60-90, 90+ days)
- Payment history

### 15.2 IOS Confirmation (Izvod Otvorenih Stavki)

Generate IOS confirmation letters to send to partners for balance reconciliation:
- List all open items per partner
- Request written confirmation of balance
- Track responses
- Generate adjustment entries for discrepancies

### 15.3 Automatic Matching

When bank statement payments are imported:
1. Match by payment reference (poziv na broj)
2. Match by partner + amount
3. AI-suggested matching for unclear references
4. Partial payment handling
5. Overpayment handling (create advance or refund)

---

## 16. Year-End Closing

### 16.1 Closing Checklist

Following Pantheon's approach:

1. Verify all bank statements imported and reconciled
2. Run depreciation for all 12 months
3. Calculate provisions for bad debts
4. FX revaluation for all foreign currency balances
5. Accrue all known expenses
6. Verify POPDV for all periods
7. Close revenue accounts (class 6) → class 7
8. Close expense accounts (class 5) → class 7
9. Calculate profit/loss
10. Generate PDP (Corporate income tax return)
11. Generate annual financial statements
12. Lock all fiscal periods for the year
13. Create opening balance entries for new year

### 16.2 Automated Year-End Journal Entries

The system should automatically generate closing entries:
- DR 7100 / CR 6xxx (close all revenue accounts)
- DR 5xxx / CR 7200 (close all expense accounts)
- Calculate net result: 7100 - 7200 = Profit/Loss → post to 3400/3410

---

## 17. Serbian Accounting Law AI Agent

### 17.1 Overview

A specialized AI agent trained on Serbian accounting legislation that provides real-time guidance, compliance checks, and document validation within the ERP system.

### 17.2 Knowledge Base

The agent must be trained on / have access to:

| Law / Regulation | Content |
|-----------------|---------|
| Zakon o racunovodstvu (Law on Accounting) | RS 73/2019, amendments through 2025 |
| Zakon o PDV (VAT Law) | RS 84/2004, all amendments through 2025 |
| Zakon o porezu na dobit pravnih lica (CIT Law) | Corporate income tax rules |
| Zakon o porezu na dohodak gradjana (PIT Law) | Personal income tax rules |
| Zakon o doprinosima (Contributions Law) | Social insurance contribution rules |
| Zakon o elektronskom fakturisanju (eFaktura Law) | RS 44/2021, amendments 109/2025 |
| Zakon o elektronskim otpremnicama (eDelivery Law) | New 2024 law on electronic delivery notes |
| Pravilnik o kontnom okviru (Chart of Accounts Rulebook) | Standard chart of accounts framework |
| Pravilnik o POPDV (POPDV Rulebook) | VAT calculation overview form rules |
| Pravilnik o PPP-PD | Individual tax return form rules |
| Pravilnik o poreskom bilansu (PDP Rulebook) | Corporate tax return rules |
| MRS / MSFI (IAS / IFRS) | International accounting standards applied in Serbia |
| Pravilnik za mala i mikro pravna lica | Standards for small and micro entities |
| Zakon o radu (Labor Law) | Employment rules affecting payroll |
| Zakon o fiskalnim kasama | Fiscal cash register rules |

### 17.3 Agent Capabilities

#### A. Real-Time Posting Validation

When a user creates a journal entry, the agent checks:
- Is this posting consistent with Serbian accounting standards?
- Are the correct accounts being used for this transaction type?
- Is the POPDV field correctly mapped?
- Are analytics (partner, employee, etc.) properly assigned?

```
User posts: DR 5120 / CR 4320 for electricity bill
Agent: ✓ Correct. Did you also record the input VAT?
        Suggested: Add line DR 2700 (Prethodni PDV) for the VAT amount.
        POPDV: This should be mapped to field 8a.1 (base) and 8e.1 (input VAT).
```

#### B. POPDV Compliance Check

Before submitting the POPDV form, the agent:
- Cross-references all posted transactions against POPDV field mappings
- Identifies unmapped transactions
- Validates that POPDV totals match GL balances
- Flags discrepancies between SEF data and GL

```
Agent: ⚠ Warning: POPDV field 3.2 shows output VAT of 150,000 RSD,
       but the GL balance on account 4350 shows 148,500 RSD.
       Discrepancy: 1,500 RSD. Please review invoice #245.
```

#### C. Payroll Compliance

The agent monitors:
- Are contribution rates current? (checks against latest Sluzbeni glasnik)
- Is the non-taxable amount up to date?
- Are minimum/maximum contribution bases respected?
- Is the PPP-PD form correctly generated?

```
Agent: ℹ The non-taxable amount changed to 25,000 RSD effective 01.01.2026
       per Sluzbeni glasnik RS 15/2026. Your system still uses 24,000 RSD.
       [Update Now] [Dismiss]
```

#### D. Year-End Guidance

The agent provides a step-by-step guided workflow for year-end closing:
- Checklist of required steps with status
- Warnings for missing steps (e.g., "Depreciation not run for December")
- Regulatory deadlines reminders
- Financial statement validation against Serbian law requirements

#### E. Regulatory Change Monitoring

The agent monitors for:
- Changes to tax rates
- New regulations published in Sluzbeni glasnik
- eFaktura/SEF system changes
- Deadline reminders (PP-PDV, PDP, annual financial statements)

### 17.4 Agent Technical Implementation

#### Architecture

```
┌─────────────────────────────────────────┐
│           Serbian Accounting Agent       │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌────────────────┐  │
│  │  RAG Engine   │  │  Rules Engine  │  │
│  │  (Knowledge   │  │  (Validation   │  │
│  │   Base)       │  │   Rules)       │  │
│  └──────┬───────┘  └───────┬────────┘  │
│         │                   │           │
│  ┌──────┴───────────────────┴────────┐  │
│  │        LLM (Claude)               │  │
│  │  - Contextual reasoning           │  │
│  │  - Natural language interaction   │  │
│  │  - Complex scenario analysis      │  │
│  └──────────────┬───────────────────┘  │
│                  │                      │
│  ┌──────────────┴───────────────────┐  │
│  │       Integration Layer           │  │
│  │  - GL posting hooks               │  │
│  │  - Invoice validation hooks       │  │
│  │  - POPDV generation hooks         │  │
│  │  - Payroll calculation hooks      │  │
│  │  - Year-end process hooks         │  │
│  └──────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│           User Interfaces               │
│  - Chat panel (ask questions)           │
│  - Inline suggestions (in forms)        │
│  - Validation alerts (on posting)       │
│  - Compliance dashboard                 │
│  - Regulatory update notifications      │
└─────────────────────────────────────────┘
```

#### Edge Function: `serbian-accounting-agent`

```typescript
// Supabase Edge Function
Deno.serve(async (req: Request) => {
  const { query, context, tenant_id } = await req.json();

  // Context includes:
  // - Current GL balances
  // - Open journal entry being created
  // - Invoice being processed
  // - POPDV data for current period
  // - Payroll calculation in progress

  // RAG retrieval from Serbian law knowledge base
  const relevantLaws = await retrieveFromKnowledgeBase(query, context);

  // Rules engine check
  const validationResults = await runValidationRules(context);

  // LLM reasoning with Serbian accounting context
  const response = await callClaude({
    system: SERBIAN_ACCOUNTING_SYSTEM_PROMPT,
    context: { relevantLaws, validationResults, ...context },
    query
  });

  // Log for audit
  await logAgentDecision(tenant_id, query, response);

  return new Response(JSON.stringify(response));
});
```

#### System Prompt (Core)

```
You are a Serbian Accounting Expert Agent integrated into an ERP system.
You have deep knowledge of:
- Zakon o racunovodstvu (Law on Accounting) of Republic of Serbia
- Zakon o PDV (VAT Law) and all related pravilnici
- Serbian kontni okvir (chart of accounts framework)
- POPDV form structure and field mappings
- Payroll calculation rules per Serbian labor and tax law
- eFaktura / SEF system requirements
- IAS/IFRS as applied in Serbia
- Year-end closing procedures per Serbian law

Your role is to:
1. Validate accounting entries against Serbian law
2. Suggest correct GL accounts and POPDV mappings
3. Check payroll calculations for compliance
4. Guide users through complex transactions
5. Alert on regulatory changes
6. Assist with year-end closing procedures

Always cite the specific law, article, or pravilnik when providing guidance.
Always provide both the legal basis and the practical accounting entry.
Respond in Serbian or English based on user preference.
```

### 17.5 Agent Interaction Examples

#### Example 1: Invoice POPDV Help
```
User: "Pravim fakturu za uslugu konsaltinga za firmu u EU. Koji POPDV?"
Agent: "Za uslugu konsaltinga pruženu pravnom licu sa sedištem u EU:
  - Mesto prometa se odredjuje po članu 12, stav 4 Zakona o PDV
  - Mesto prometa je mesto gde primalac ima sedište (EU)
  - PDV se NE obračunava (nije predmet oporezivanja u Srbiji)
  - eFaktura kategorija: O (Not subject to VAT)
  - POPDV: Polje 11.1 (promet u inostranstvu)
  - Na fakturi navesti: 'PDV nije obračunat - član 12, stav 4 Zakona o PDV'

  Knjiženje:
  DR 2030 Kupci u inostranstvu | EUR iznos
  CR 6120 Prihodi od usluga   | EUR iznos"
```

#### Example 2: Bank Statement Classification
```
User: "Primili smo uplatu 500,000 RSD sa pozivom na broj koji ne prepoznajem"
Agent: "Na osnovu poziva na broj 97 12345678901234:
  - Model 97 ukazuje na poziv po modelu odobrenja
  - Kontrolni broj 1 upućuje na to da je ovo uplata po fakturi
  - Pretraga otvorenih stavki: Faktura #234 za partnera XYZ DOO, iznos 500,000 RSD
  - Predlog: Zatvori fakturu #234

  Knjiženje:
  DR 2410 Tekući račun (izvod) | 500,000
  CR 2020 Kupci u zemlji       | 500,000
  Analitika: XYZ DOO
  POPDV: Nema uticaja (nije promet)"
```

#### Example 3: Year-End Check
```
User: "Da li sam spreman za zatvaranje 2025. godine?"
Agent: "Provera statusa za zatvaranje 2025:
  ✓ Svi izvodi uvezeni (12/12 meseci)
  ✓ Amortizacija obračunata (12/12 meseci)
  ⚠ Kursne razlike: Devizna potraživanja na dan 31.12. nisu revalorizovana
  ✗ POPDV za Q4 2025 nije podnet
  ✗ Zatvaranje klasa 4 i 7 nije izvršeno
  ✓ Bilans stanja pripremljen
  ⚠ PDP (porez na dobit): Nije pripremljen

  Rok za predaju finansijskih izveštaja APR-u: 31.03.2026
  Rok za predaju PDP: 15.06.2026

  Sledeći korak: Pokrenite revalorizaciju deviznih stavki na dan 31.12.2025."
```

---

## 18. Database Schema Changes

### 18.1 chart_of_accounts - Add Fields

```sql
ALTER TABLE chart_of_accounts
ADD COLUMN analytics_type TEXT DEFAULT 'NONE'
  CHECK (analytics_type IN ('NONE', 'PARTNER', 'EMPLOYEE', 'OBJECT', 'COST_CENTER')),
ADD COLUMN is_foreign_currency BOOLEAN DEFAULT false,
ADD COLUMN tracks_cost_center BOOLEAN DEFAULT false,
ADD COLUMN tracks_cost_bearer BOOLEAN DEFAULT false,
ADD COLUMN is_closing_account BOOLEAN DEFAULT false;
```

### 18.2 invoice_lines - Add Fields

```sql
ALTER TABLE invoice_lines
ADD COLUMN item_type TEXT DEFAULT 'SERVICE'
  CHECK (item_type IN ('GOODS', 'SERVICE', 'PRODUCT')),
ADD COLUMN popdv_field TEXT,
ADD COLUMN efaktura_category TEXT DEFAULT 'S',
ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
```

### 18.3 invoices - Add Fields

```sql
ALTER TABLE invoices
ADD COLUMN invoice_type TEXT DEFAULT 'FINAL'
  CHECK (invoice_type IN ('FINAL', 'ADVANCE', 'ADVANCE_FINAL', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE')),
ADD COLUMN linked_advance_invoice_id UUID REFERENCES invoices(id),
ADD COLUMN posted_at TIMESTAMPTZ,
ADD COLUMN posting_journal_entry_id UUID REFERENCES journal_entries(id);
```

### 18.4 journal_entry_lines - Add Fields

```sql
ALTER TABLE journal_entry_lines
ADD COLUMN analytics_type TEXT,
ADD COLUMN analytics_reference_id UUID,
ADD COLUMN analytics_label TEXT,
ADD COLUMN foreign_currency TEXT,
ADD COLUMN foreign_amount DECIMAL(15,2),
ADD COLUMN exchange_rate DECIMAL(15,6),
ADD COLUMN popdv_field TEXT;
```

### 18.5 New Table: popdv_records

```sql
CREATE TABLE popdv_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  legal_entity_id UUID REFERENCES legal_entities(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'submitted', 'accepted')),
  -- Section 1: Exempt with deduction
  field_1_1 DECIMAL(15,2) DEFAULT 0, -- Export
  field_1_2 DECIMAL(15,2) DEFAULT 0, -- Free zones
  field_1_3 DECIMAL(15,2) DEFAULT 0, -- Transport services
  field_1_4 DECIMAL(15,2) DEFAULT 0, -- Other exempt
  field_1_5 DECIMAL(15,2) DEFAULT 0, -- Total
  -- Section 2: Exempt without deduction
  field_2_1 DECIMAL(15,2) DEFAULT 0,
  field_2_2 DECIMAL(15,2) DEFAULT 0,
  field_2_3 DECIMAL(15,2) DEFAULT 0,
  field_2_4 DECIMAL(15,2) DEFAULT 0,
  field_2_5 DECIMAL(15,2) DEFAULT 0,
  -- Section 3: Taxable supply
  field_3_1_base DECIMAL(15,2) DEFAULT 0, -- 20% base
  field_3_2_vat DECIMAL(15,2) DEFAULT 0,  -- 20% VAT
  field_3_3_base DECIMAL(15,2) DEFAULT 0, -- 10% base
  field_3_4_vat DECIMAL(15,2) DEFAULT 0,  -- 10% VAT
  field_3_5 DECIMAL(15,2) DEFAULT 0, -- Increase base
  field_3_6 DECIMAL(15,2) DEFAULT 0, -- Increase VAT
  field_3_7 DECIMAL(15,2) DEFAULT 0, -- Decrease base
  field_3_8 DECIMAL(15,2) DEFAULT 0, -- Decrease VAT
  field_3_9 DECIMAL(15,2) DEFAULT 0, -- Advance base
  field_3_10 DECIMAL(15,2) DEFAULT 0, -- Advance VAT
  -- Section 3a: Reverse charge
  field_3a_1 DECIMAL(15,2) DEFAULT 0,
  field_3a_2 DECIMAL(15,2) DEFAULT 0,
  -- Section 5: Totals
  field_5_1 DECIMAL(15,2) DEFAULT 0,
  field_5_2 DECIMAL(15,2) DEFAULT 0,
  field_5_3 DECIMAL(15,2) DEFAULT 0,
  -- Section 6: Imports
  field_6_1 DECIMAL(15,2) DEFAULT 0,
  field_6_2 DECIMAL(15,2) DEFAULT 0,
  field_6_3 DECIMAL(15,2) DEFAULT 0,
  -- Section 7: Farmers
  field_7_1 DECIMAL(15,2) DEFAULT 0,
  field_7_2 DECIMAL(15,2) DEFAULT 0,
  -- Section 8: Purchases
  field_8a_base DECIMAL(15,2) DEFAULT 0,
  field_8a_vat DECIMAL(15,2) DEFAULT 0,
  field_8b_base DECIMAL(15,2) DEFAULT 0,
  field_8b_vat DECIMAL(15,2) DEFAULT 0,
  field_8v_base DECIMAL(15,2) DEFAULT 0,
  field_8g_base DECIMAL(15,2) DEFAULT 0,
  field_8g_vat DECIMAL(15,2) DEFAULT 0,
  field_8d_base DECIMAL(15,2) DEFAULT 0,
  field_8e_1 DECIMAL(15,2) DEFAULT 0, -- Input VAT (supplier debtor)
  field_8e_2 DECIMAL(15,2) DEFAULT 0, -- Input VAT (recipient debtor)
  field_8e_3 DECIMAL(15,2) DEFAULT 0, -- Correction increase
  field_8e_4 DECIMAL(15,2) DEFAULT 0, -- Correction decrease
  field_8e_5 DECIMAL(15,2) DEFAULT 0, -- Total input VAT
  -- Section 9: Total purchases
  field_9_1 DECIMAL(15,2) DEFAULT 0,
  -- Section 9a: Input VAT in return
  field_9a_1 DECIMAL(15,2) DEFAULT 0, -- Import VAT
  field_9a_2 DECIMAL(15,2) DEFAULT 0, -- Farmer compensation
  field_9a_3 DECIMAL(15,2) DEFAULT 0, -- Other input VAT
  field_9a_4 DECIMAL(15,2) DEFAULT 0, -- Total input VAT
  -- Section 10: Tax obligation
  field_10_1 DECIMAL(15,2) DEFAULT 0,
  -- Section 11: Foreign supply
  field_11_1 DECIMAL(15,2) DEFAULT 0,
  --
  xml_export TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 18.6 New Table: supplier_invoice_lines (if not exists)

```sql
CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
  description TEXT NOT NULL,
  item_type TEXT DEFAULT 'SERVICE' CHECK (item_type IN ('GOODS', 'SERVICE', 'PRODUCT')),
  quantity DECIMAL(15,4) DEFAULT 1,
  unit_price DECIMAL(15,2) DEFAULT 0,
  tax_rate_id UUID REFERENCES tax_rates(id),
  tax_rate_value DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_with_tax DECIMAL(15,2) DEFAULT 0,
  popdv_field TEXT,
  efaktura_category TEXT,
  account_id UUID REFERENCES chart_of_accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  sort_order INTEGER DEFAULT 0
);
```

---

## 19. Implementation Phases

### Phase 1: Foundation Fixes (Weeks 1-3) - CRITICAL

**Goal:** Fix everything the accountant flagged as broken.

1. **Chart of Accounts**
   - Add analytics_type, is_foreign_currency, cost center tracking fields
   - Load FULL Serbian kontni okvir (all missing accounts)
   - Add account search with typeahead
   - Enforce 4+ digit posting rule

2. **Journal Entries**
   - Fix: accounts not loading beyond 433x
   - Fix: posting not working
   - Add: account search bar
   - Add: analytics selection per line
   - Add: 4-digit minimum enforcement
   - Add: proper debit/credit validation

3. **Invoice Form**
   - Remove voucher type from main form
   - Auto-select legal entity (if single)
   - Add item_type (Goods/Service/Product) per line
   - Add POPDV field mapping per line
   - Add eFaktura category per line
   - Add posting preview before send
   - Add advance invoice linking
   - Fix partner selection → navigate to full partner form

4. **Bank Statements**
   - Fix XML import parser
   - Fix auto-numbering logic
   - Ensure PDF import works (even basic)

### Phase 2: Full Posting Chain (Weeks 4-6)

**Goal:** Every document posts correctly to the GL.

1. Invoice posting with correct accounts per item type
2. Supplier invoice posting
3. Bank statement line posting with payment models
4. Cash register posting
5. Posting preview on ALL document types
6. Posting reversal (storno) working correctly

### Phase 3: VAT & Compliance (Weeks 7-9)

**Goal:** Full POPDV/PP-PDV support.

1. POPDV field mapping across all transactions
2. Automatic POPDV form generation
3. PP-PDV form generation
4. XML export for ePorezi
5. Tax period management (open/close/lock)
6. eFaktura category on all invoices

### Phase 4: Payroll (Weeks 10-12)

**Goal:** Complete payroll from calculation to payment.

1. Employee register with all required fields
2. Monthly payroll calculation with current Serbian rates
3. Configurable parameters with effective dates
4. PPP-PD form generation (XML export)
5. Payment order generation
6. GL posting of payroll
7. Payslip generation

### Phase 5: Reports & Closing (Weeks 13-15)

**Goal:** All standard reports and year-end closing.

1. Account card (kartica konta) with filtering
2. Partner card (IOS)
3. Daily journal (dnevnik knjizenja)
4. Cash flow statement
5. Year-end closing workflow
6. Opening balance generation
7. Financial statement submission to APR

### Phase 6: AI Agent (Weeks 16-18)

**Goal:** Serbian Accounting Law AI Agent operational.

1. Knowledge base creation (all Serbian laws)
2. Edge function implementation
3. Inline validation hooks (posting, invoicing, payroll)
4. Chat interface for accounting questions
5. POPDV compliance checker
6. Regulatory change monitoring
7. Year-end guided wizard

### Phase 7: Polish & Advanced (Weeks 19-20)

**Goal:** Feature parity with competitors.

1. Fixed asset register UI and depreciation automation
2. Credit notes and debit notes
3. Proforma invoices
4. IOS balance confirmations
5. Multi-currency improvements
6. Performance optimization
7. Edge case handling

---

## 20. Acceptance Criteria

### Must Pass Before Release

- [ ] All 20 issues from accountant review are resolved
- [ ] Full Serbian kontni okvir loaded (all classes 0-9, all standard 4-digit accounts)
- [ ] Chart of accounts supports analytics (partner, employee, object, cost center)
- [ ] Chart of accounts supports foreign currency flag
- [ ] Invoice creation distinguishes between goods, service, and product
- [ ] Every invoice line has POPDV field and eFaktura category
- [ ] Posting preview available on all document types
- [ ] All document types post correctly to GL
- [ ] Journal entries enforce 4+ digit accounts
- [ ] Journal entries require analytics when account demands it
- [ ] Bank statement XML import works with Serbian bank formats
- [ ] Bank statement auto-numbering follows convention (e.g., iz567-1)
- [ ] POPDV form generates automatically from posted transactions
- [ ] PP-PDV form generates from POPDV data
- [ ] Payroll calculates correctly per Serbian tax law
- [ ] PPP-PD form generates in XML format
- [ ] Year-end closing workflow completes successfully
- [ ] Account card (kartica konta) report works with all filters
- [ ] Partner card (IOS) report works
- [ ] AI Agent provides correct Serbian law guidance
- [ ] AI Agent validates GL postings against Serbian standards
- [ ] All forms support Serbian language
- [ ] No regression in existing functionality

---

## Appendix A: Serbian Accounting Law Reference

| Law | Official Gazette | Key Content |
|-----|-----------------|-------------|
| Zakon o racunovodstvu | RS 73/2019 | General accounting requirements |
| Zakon o PDV | RS 84/2004, amendments through 2025 | VAT rules, rates, exempt transactions |
| Zakon o porezu na dobit | RS 25/2001, amendments | Corporate income tax (15%) |
| Zakon o porezu na dohodak gradjana | RS 24/2001, amendments | Personal income tax rules |
| Zakon o doprinosima | RS 84/2004, amendments | Social contribution rates |
| Zakon o elektronskom fakturisanju | RS 44/2021, 109/2025 | e-Invoice / SEF requirements |
| Zakon o elektronskim otpremnicama | 2024 | Electronic delivery notes (new) |
| Pravilnik o kontnom okviru | RS 89/2020 | Chart of accounts framework |
| Pravilnik o POPDV | RS 90/2017 | POPDV form structure and rules |
| Pravilnik o PPP-PD | Various | Individual tax return form |

## Appendix B: Account Classes Quick Reference

| Class | Range | Type | Description (SR) |
|-------|-------|------|-------------------|
| 0 | 0000-0999 | Non-current Assets | Stalna imovina |
| 1 | 1000-1999 | Inventories | Zalihe |
| 2 | 2000-2999 | Receivables & Cash | Potrazivanja i gotovina |
| 3 | 3000-3999 | Capital | Kapital |
| 4 | 4000-4999 | Liabilities | Obaveze |
| 5 | 5000-5999 | Expenses | Rashodi |
| 6 | 6000-6999 | Income | Prihodi |
| 7 | 7000-7999 | Opening/Closing | Otvaranje i zakljucivanje |
| 8 | 8000-8999 | Off-balance | Vanbilansna evidencija |
| 9 | 9000-9999 | Cost accounting | Obracun troskova |

## Appendix C: POPDV Field Quick Reference

| Field | Description | Direction |
|-------|-------------|-----------|
| 1.1-1.5 | Zero-rated supply (exports, etc.) | Output |
| 2.1-2.5 | Exempt supply (no deduction) | Output |
| 3.1-3.10 | Taxable supply + VAT | Output |
| 3a.1-3a.2 | Reverse charge VAT | Output |
| 4.1-4.4 | Special procedures | Output |
| 5.1-5.7 | Total output summary | Summary |
| 6.1-6.3 | Import VAT | Input |
| 7.1-7.2 | Farmer purchases | Input |
| 8a-8e | Purchase categories + input VAT | Input |
| 9.1 | Total purchases | Summary |
| 9a.1-9a.4 | Total input VAT | Summary |
| 10.1 | Tax obligation | Net |
| 11.1 | Foreign supply (not subject to VAT) | Info |

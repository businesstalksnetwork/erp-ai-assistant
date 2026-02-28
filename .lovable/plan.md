

## Phase 2: Serbian Legal Compliance — 9 Items

### Audit Results

| # | Finding | Status |
|---|---------|--------|
| 2.1 | `BilansUspeha.tsx` includes Class 8 ("Vanredni rashodi") — actually "Vanbilansna evidencija" (off-balance sheet), must be removed from P&L. Revenue fallback section is "50" instead of "60" | Confirmed — lines 23-28 and line 93 |
| 2.2 | AOP position mapping for APR filing | Already exists — `aop_positions` table + `AopPositions.tsx` page + `get_aop_report` RPC. Needs seeding with official APR data and XML export wiring |
| 2.3 | ZPDP 5-group tax depreciation | Partially exists — `fixed_assets` has `tax_group`, `tax_depreciation_rate`, `tax_depreciation_method` columns. Missing: UI for ZPDP group selection, declining-balance calculation per group, tax vs. accounting difference report |
| 2.4 | Full PB-1 (Poreski Bilans) form (~70 line items) | Does not exist — no page, no table, no RPC |
| 2.5 | SEF VAT support — currently hardcoded to SS (paušalci, 0% VAT) | Confirmed — `sef-send-invoice/index.ts` lines 76-90 hardcode `SS` category and `taxAmount = 0` |
| 2.6 | PPP-PD hardcoded non-taxable amount 25000 | Confirmed — `generate-pppd-xml/index.ts` line 105 |
| 2.7 | PP-PDV XML namespace wrong | Confirmed — `popdvAggregation.ts` line 342 uses `http://www.purs.gov.rs/pppdv` |
| 2.8 | Document retention tracking | Already exists — `archive_book` table has `retention_period`/`retention_years`, `Archiving.tsx` and `ArchiveBook.tsx` pages exist. Missing: deletion blocking enforcement |
| 2.9 | Kontni Okvir class label inaccuracies | Confirmed — `ImportChartOfAccounts.tsx` lines 44-55 have wrong labels for classes 1, 2, 4 |

### Implementation Plan

#### 2.1: Fix BilansUspeha Class 8 + revenue fallback
- Remove Class 8 from `ACCOUNT_CLASSES` (line 27)
- Fix revenue section fallback from `"50"` to `"60"` (line 93)
- Fix expense section fallback from `"60"` to `"50"` (line 100)

#### 2.2: Seed AOP positions + wire APR XML export
- Skip — infrastructure already exists. Create a migration to seed official APR AOP positions (Obrazac 1 and Obrazac 2) if the table is empty
- Wire `generate-apr-xml` edge function to use `get_aop_report` RPC data

#### 2.3: ZPDP tax depreciation UI + calculation
- Add ZPDP group selector (I-V) to `AssetDepreciation.tsx` or asset detail page
- Migration: create `calculate_tax_depreciation` RPC that applies declining-balance rates per ZPDP group
- Add tax vs. accounting depreciation comparison view

#### 2.4: PB-1 Poreski Bilans form
- Migration: create `pb1_line_items` reference table (~70 positions) and `pb1_submissions` table for saved forms
- New page `PoreskiBilans.tsx` at `/accounting/reports/poreski-bilans`
- Auto-populate from GL data + tax depreciation adjustments
- Add route, nav entry, translations

#### 2.5: SEF VAT category support
- Refactor `generateUBLXml` in `sef-send-invoice/index.ts` to detect VAT registration from company profile
- Map invoice tax rates to UBL categories: S (10%, 20%), AE (reverse charge), Z (zero-rated), E (exempt), O (out of scope), SS (paušalci)
- Support credit note (381) and debit note (383) type codes

#### 2.6: Fix PPP-PD non-taxable amount
- In `generate-pppd-xml/index.ts`: query `payroll_parameters` table for the period's non-taxable amount instead of hardcoded 25000
- Add `NajnizaOsnovica` and `NajvisaOsnovica` XML tags

#### 2.7: Fix PP-PDV XML namespace
- In `popdvAggregation.ts` line 342: change `http://www.purs.gov.rs/pppdv` to `urn:poreskauprava.gov.rs:pppdv`

#### 2.8: Document retention deletion blocking
- Skip — retention tracking already exists. Add a database trigger `trg_block_retention_delete` on `archive_book` that prevents deletion if `retention_years` hasn't expired

#### 2.9: Fix Kontni Okvir class labels
- In `ImportChartOfAccounts.tsx`: fix CLASS_NAMES:
  - Class 1: "Zalihe" (not "Zalihe i stalna sredstva")
  - Class 2: "Kratkoročna potraživanja, plasmani i gotovina" (not "Kratkoročne obaveze i PVR")
  - Class 4: "Dugoročne i kratkoročne obaveze" (not "Kapital i dugoročne obaveze")

### Scope for This Implementation

Given the size of Phase 2, I recommend splitting into two batches:

**Batch A (quick fixes — items 2.1, 2.6, 2.7, 2.8, 2.9):** Code fixes and small migrations — can be done in one pass.

**Batch B (new features — items 2.2, 2.3, 2.4, 2.5):** AOP seeding, ZPDP depreciation, PB-1 form, SEF VAT — each is substantial and needs careful implementation.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/tenant/BilansUspeha.tsx` | 2.1 — remove Class 8, fix section fallbacks |
| `src/components/accounting/ImportChartOfAccounts.tsx` | 2.9 — fix CLASS_NAMES labels |
| `src/lib/popdvAggregation.ts` | 2.7 — fix XML namespace |
| `supabase/functions/generate-pppd-xml/index.ts` | 2.6 — dynamic non-taxable amount |
| New migration SQL | 2.8 — retention delete trigger |
| New migration SQL | 2.2 — AOP seed data |
| New migration SQL | 2.3 — tax depreciation RPC |
| New migration SQL + new page | 2.4 — PB-1 tables + `PoreskiBilans.tsx` |
| `supabase/functions/sef-send-invoice/index.ts` | 2.5 — VAT category support |
| Routes, nav, translations | 2.4 — PB-1 route + nav entry |

### Execution Order
1. Batch A migration (retention trigger) + code fixes (2.1, 2.7, 2.9)
2. Edge function fixes (2.6 PPP-PD, 2.7 namespace)
3. Batch B: AOP seeding (2.2), ZPDP depreciation (2.3), PB-1 form (2.4), SEF VAT (2.5)


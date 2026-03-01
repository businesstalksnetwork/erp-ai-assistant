

# V4 PRD Implementation — Phased Roadmap

## PRD Summary

The V4 PRD identifies **6 bugs (CR5)**, **12 regulatory gaps**, **34 contract templates**, **10 AI improvements**, and **30+ module upgrades** across a 5-phase roadmap targeting an overall rating increase from 4.43 to 4.68 (surpassing SAP).

---

## Phase 1: Critical Bug Fixes (This Session)

Fix all 6 CR5 bugs identified in the audit.

| # | Bug | Fix |
|---|-----|-----|
| CR5-01 | `document_signatures` RLS uses `USING (true)` — anyone can read/update any signature | Migration: replace public policies with token-scoped RLS using `token` column match in the query filter. Keep public SELECT/UPDATE but restrict to rows matching a specific token passed as query parameter. Since anon users can't use `current_setting`, the edge function approach is already correct — tighten RLS to require `status = 'pending'` and `expires_at > now()` for public updates |
| CR5-02 | `document-ocr` updates non-existent `dms_documents` table | Fix to `documents` in edge function |
| CR5-03 | `DocumentApprovals.tsx` missing `tenant_id` filter | Already has `.eq("tenant_id", tenantId)` on line 45 — confirmed false positive, RLS also protects. No action needed |
| CR5-04 | Race condition in approval counting | Add DB-level count query before completing workflow instead of local array count |
| CR5-05 | `VatSpecialSchemes` not persisted | Save/load scheme config to `tenant_settings` table |
| CR5-06 | Hardcoded NBS reference rate | Make configurable via `tenant_settings`, default to 6.5% + 8% |

---

## Phase 2: Contract Templates & AI (Next Session)

### 2A: HR Contract Template Engine
- Create `hr_contract_templates` table with 14 pre-seeded Serbian templates (permanent, fixed-term, amendment, service contract, copyright, etc.)
- Create `HrContractTemplates.tsx` — template library with variable substitution from employee data
- Create `HrContractGenerator.tsx` — AI-powered form that pre-fills variables, validates mandatory ZoR clauses
- Integration with DMS for archiving generated contracts

### 2B: DMS Business Agreement Templates
- Create `business_contract_templates` table with 20 pre-seeded templates (sales, purchase, lease, NDA, cesija, loan, etc.)
- Auto-include Serbian legal clauses (merodavno pravo, PDV, ZZPL, viša sila)
- Create `BusinessContractTemplates.tsx` — template picker with partner auto-fill

### 2C: AI Enhancements
- **AI-04: Tax Calendar** — `TaxCalendar.tsx` page with Serbian tax deadline reminders (POPDV 15th, PPP-PD 15th, CIT advance, property tax quarterly)
- **AI-07: Document Classifier** — Extend `document-ocr` to auto-categorize by content type

---

## Phase 3: Module Upgrades (Future)

- HR: Travel orders (putni nalozi), org chart, overtime tracking
- POS: Manager override, loyalty POS integration
- Banking: Fuzzy matching, SEPA pain.001
- CRM: Credit limit checks, quote templates
- Restaurant: Super admin module isolation with `tenant_enabled_modules`

---

## Phase 4: Advanced AI (Future)

- AI Invoice Anomaly Detection (AI-02)
- AI Cash Flow Predictor (AI-06)
- AI Supplier Scoring (AI-05)
- AI Payroll Predictor (AI-03)

---

## Phase 5: Enterprise Features (Future)

- MRP auto-run, lot/batch traceability
- SEPA + IPS QR integration
- Performance reviews, multi-register POS sync

---

## Recommendation

Start with **Phase 1 (CR5 bug fixes)** now — 1 migration, 3 file edits, 1 edge function fix. Quick wins that improve security and data integrity.


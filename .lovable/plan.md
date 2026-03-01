
# V4 PRD Implementation — Phased Roadmap

## Phase 1: Critical Bug Fixes ✅ DONE

| # | Bug | Status |
|---|-----|--------|
| CR5-01 | `document_signatures` RLS USING(true) → token-scoped + status/expiry checks | ✅ |
| CR5-02 | `document-ocr` references `dms_documents` → fixed to `documents` | ✅ |
| CR5-03 | `DocumentApprovals.tsx` tenant_id filter — false positive, already present | ✅ N/A |
| CR5-04 | Approval counting race condition → DB-level count + status re-check | ✅ |
| CR5-05 | `VatSpecialSchemes` not persisted → saved to `tenant_settings` | ✅ |
| CR5-06 | Hardcoded NBS rate → configurable via `tenant_settings` | ✅ |

---

## Phase 2: Contract Templates & AI (Next)

### 2A: HR Contract Template Engine
- Create `hr_contract_templates` table with 14 pre-seeded Serbian templates
- `HrContractTemplates.tsx` — template library with variable substitution
- `HrContractGenerator.tsx` — AI-powered form with ZoR clause validation

### 2B: DMS Business Agreement Templates
- Create `business_contract_templates` table with 20 pre-seeded templates
- Auto-include Serbian legal clauses
- `BusinessContractTemplates.tsx` — template picker with partner auto-fill

### 2C: AI Enhancements
- AI-04: Tax Calendar with Serbian deadlines
- AI-07: Document Classifier in OCR pipeline

---

## Phase 3: Module Upgrades (Future)
- HR: Travel orders, org chart, overtime
- POS: Manager override, loyalty
- Banking: Fuzzy matching, SEPA pain.001
- CRM: Credit limits, quote templates

## Phase 4: Advanced AI (Future)
- AI-02: Invoice Anomaly Detection
- AI-06: Cash Flow Predictor
- AI-05: Supplier Scoring
- AI-03: Payroll Predictor

## Phase 5: Enterprise Features (Future)
- MRP auto-run, lot/batch traceability
- SEPA + IPS QR
- Performance reviews, multi-register POS sync

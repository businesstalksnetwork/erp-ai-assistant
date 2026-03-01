
# V4 PRD Implementation — Phased Roadmap

## Phase 1: Critical Bug Fixes ✅ DONE

| # | Bug | Status |
|---|-----|--------|
| CR5-01 | `document_signatures` RLS tightened | ✅ |
| CR5-02 | `document-ocr` table name fixed | ✅ |
| CR5-03 | False positive — already present | ✅ N/A |
| CR5-04 | Approval race condition fixed | ✅ |
| CR5-05 | VatSpecialSchemes persisted | ✅ |
| CR5-06 | NBS rate configurable | ✅ |

---

## Phase 2: Contract Templates & AI ✅ DONE

| # | Item | Status |
|---|------|--------|
| 2A | HR Contract Templates (14 types, `HrContractTemplates.tsx`) | ✅ |
| 2A | HR Contract Generator (AI-powered, `HrContractGenerator.tsx`) | ✅ |
| 2B | Business Contract Templates (20 types, `BusinessContractTemplates.tsx`) | ✅ |
| 2C-AI04 | Tax Calendar (`TaxCalendar.tsx`) with Serbian deadlines | ✅ |
| 2C-AI07 | Document Classifier in OCR pipeline | ✅ |

### Routes Added
- `hr/contract-templates` — HR contract template library
- `hr/contract-generator` — AI-powered contract generation
- `documents/business-contracts` — Business contract templates
- `ai/tax-calendar` — Serbian tax deadline calendar

---

## Phase 3: Module Upgrades (Next)
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

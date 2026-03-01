

# ISO Compliance Implementation — Phased Plan

After reviewing all 1258 lines of the PRD, here's the breakdown into 5 implementable phases. Documentation-only items (policies, manuals) and CI/CD pipeline (QMS-01) are out of scope for Lovable but noted for your reference.

---

## Phase ISO-1: Security Foundation (SEC-01 through SEC-08 + CR7 fixes)

**Shared infrastructure + critical security fixes.** Highest impact, touches all 97+ edge functions.

| Item | What | Scope |
|------|------|-------|
| SEC-01 | Create `_shared/cors.ts`, replace wildcard CORS in all 97+ functions | All edge functions |
| SEC-02 | Fix `USING(true)` RLS on voucher_types, supplier_invoice_lines, popdv_records | Migration |
| SEC-03 | Create `_shared/schemas/` with Zod, add validation to all edge functions | All edge functions |
| SEC-04 | `security_events` table + `_shared/security-logger.ts` | Migration + shared |
| SEC-05 | Create `_shared/error-handler.ts`, sanitize all error responses | All edge functions |
| SEC-06 | `_shared/security-headers.ts` + CSP meta tag in index.html | Shared + HTML |
| SEC-07 | `secret_rotation_log` table | Migration |
| SEC-08 | React ErrorBoundary component wrapping App | 1 component |
| CR7-01 | Role check for POS discount approvals | PosManagerOverride.tsx |
| CR7-02 | O(n²) → O(n) duplicate detection | ai-invoice-anomaly |
| CR7-04 | Tool_choice fallback | ai-supplier-scoring |
| CR7-06 | Configurable collection probabilities | ai-cash-flow-predict |
| CR7-07 | Line item validation (no negative qty/price) | QuoteTemplates.tsx |

**This is the largest phase — the shared modules (cors, error-handler, schemas, security-logger, security-headers) must be created first, then all 97+ edge functions updated to import them.**

---

## Phase ISO-2: AI Governance + Prompt Registry (AI-02 through AI-04)

| Item | What | Scope |
|------|------|-------|
| AI-02 | `ai_prompt_registry` table + shared loader, migrate 17+ hardcoded prompts | Migration + 23 AI functions |
| AI-03 | Confidence threshold enforcement (auto_approve/suggest/flag/reject) | 4 AI functions |
| AI-04 | Super Admin AI Governance Dashboard (token usage, action log, prompts, injections) | New page |

---

## Phase ISO-3: Privacy, Cloud & E-Invoicing (CLOUD-02, PRIV-01, EI-01, EI-02)

| Item | What | Scope |
|------|------|-------|
| CLOUD-02 | Field-level PII encryption (JMBG, bank accounts) via pgcrypto | Migration + functions |
| PRIV-01 | `data_breach_incidents` table + breach-notification edge function | Migration + edge function + page |
| EI-01 | UBL XML schema validator (EN 16931 mandatory elements) | New shared module + sef-submit edit |
| EI-02 | Replace string concatenation with XmlBuilder class | sef-submit refactor |

---

## Phase ISO-4: Business Continuity & Archival (BC-01 to BC-03, ARCH-01, ARCH-02)

| Item | What | Scope |
|------|------|-------|
| BC-01 | `health-check` edge function (DB, Storage, AI Gateway status) | New edge function |
| BC-02 | `tenant-data-export` edge function + DataExport.tsx page | Edge function + page |
| BC-03 | Super Admin SystemHealth.tsx dashboard (uptime, response times) | New page |
| ARCH-01 | `generate-pdfa` edge function (PDF/A-3 with embedded UBL XML) | New edge function |
| ARCH-02 | `enforce_document_retention()` DB function | Migration |

---

## Phase ISO-5: ITSM & Quality Model (ITSM-01, ITSM-02, SQ-02)

| Item | What | Scope |
|------|------|-------|
| ITSM-01 | `sla_definitions` + `sla_measurements` tables + SLA management page | Migration + page |
| ITSM-02 | `incidents` table + Incident Management page | Migration + page |
| SQ-02 | WCAG 2.1 AA accessibility pass (aria-labels, contrast, keyboard nav) | Component edits |

---

## Out of Scope (documentation / external tooling)

These items from the PRD require non-code deliverables:
- AI-01, AI-05: AI governance policy & impact assessment docs
- QMS-01: GitHub Actions CI/CD pipeline (not Lovable-buildable)
- QMS-02: Test coverage expansion (limited in Lovable)
- QMS-03, CLOUD-01, CLOUD-03, PRIV-02: Policy documents
- Phase 5/6 from PRD: Documentation & external audit prep

---

## Summary

| Phase | Items | Key Standards |
|-------|-------|---------------|
| ISO-1: Security Foundation | 13 items (SEC-01–08 + 5 CR fixes) | ISO 27001 |
| ISO-2: AI Governance | 3 items (AI-02–04) | ISO 42001 |
| ISO-3: Privacy & E-Invoicing | 4 items (CLOUD-02, PRIV-01, EI-01–02) | ISO 27017/18/27701, EN 16931 |
| ISO-4: Continuity & Archival | 5 items (BC-01–03, ARCH-01–02) | ISO 22301, 19005 |
| ISO-5: ITSM & Quality | 3 items (ITSM-01–02, SQ-02) | ISO 20000, 25010 |




# ISO 100% + Loyalty Upgrade — Phased Implementation Plan

This PRD contains 4 phases with 14 work items. Several items overlap with work already done (rate limiting exists in-memory, `generate-pdf` exists but returns JSON not PDF bytes, `AccountingCustomerParty` already exists in SEF functions but not in `generate-pdf`). Here's the breakdown:

---

## Phase 1: Critical Infrastructure (3 items)

### 1A. SEC-08: Upgrade Rate Limiter to DB-Backed
The current `_shared/rate-limiter.ts` is in-memory (per-instance). Upgrade to DB-backed sliding window with a `rate_limit_log` table, cleanup function, and proper 429 responses with `Retry-After` headers. Apply to all edge functions per the PRD's category limits (AI: 30/min, SEF: 60/min, CRUD: 120/min, Auth: 10/min, Export: 5/min).

**Files:** New migration, rewrite `_shared/rate-limiter.ts`, update 5+ edge functions.

### 1B. SQ-02: CI/CD Pipeline
Create `.github/workflows/ci.yml` with lint, typecheck, unit tests, build, E2E (Playwright), security audit (npm audit + TruffleHog). Triggers on push to main/develop and PRs.

**Files:** `.github/workflows/ci.yml`

### 1C. ARCH-01: Real PDF/A-3 Generation
Current `generate-pdf` returns JSON, not PDF bytes. Rewrite using `pdf-lib` to generate actual A4 PDF with invoice layout, embedded UBL XML (AF relationship), and XMP metadata. Add `AccountingCustomerParty` (BG-7) to the inline `generateUblXml()`. Delete `generate-pdfa` if it still exists.

**Files:** Rewrite `generate-pdf/index.ts`

---

## Phase 2: Compliance Workflows (4 items)

### 2A. QM-03: CAPA Workflow
New `capa_actions` table + `CapaManagement.tsx` page. Status workflow: open → in_progress → implemented → verification_pending → verified → closed. Links to incidents. KPI dashboard.

### 2B. PRIV-03: DSAR Automation
New `dsar_requests` table with 30-day deadline trigger + `DsarManagement.tsx`. Request types per ZZPL. Identity verification step. Integration with existing `tenant-data-export`.

### 2C. EI-04: BG-7 CustomerParty in generate-pdf
Already handled in 1C above (add BG-7 to the UBL XML in generate-pdf). The SEF functions already have it.

### 2D. AI-05: Model Cards & Bias Testing
New `ai_model_cards` and `ai_bias_test_log` tables. Super-admin page `AiModelCards.tsx` with pre-populated cards for all 23+ AI functions. Quarterly review scheduling.

---

## Phase 3: Documentation (2 items, no code)

### 3A. CLOUD-03: Cloud Security Controls
Create `docs/ISO-27017-27018-Cloud-Controls.md` — shared responsibility matrix, tenant isolation, PII controls, data location.

### 3B. BC-03: Disaster Recovery Runbooks
Create `docs/ISO-22301-Disaster-Recovery.md` — RTO/RPO targets, disaster scenarios, recovery procedures.

---

## Phase 4: Loyalty Module Overhaul (5 items)

### 4A. LOY-01: Fizička Lica Migration
Add `first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `card_number`, `marketing_consent`, `referred_by` columns to `loyalty_members`. Make `partner_id` nullable. Auto-generate card numbers. Create `lookup_loyalty_member` and `accrue_loyalty_points_v2` RPCs. Rewrite `LoyaltyMembers.tsx` enrollment form.

### 4B. LOY-02: Advanced Loyalty Features
New tables: `loyalty_multiplier_rules`, `loyalty_tier_benefits`, `loyalty_campaigns`. Points expiry function. Referral bonus trigger. Enhanced `LoyaltyDashboard.tsx` with 12+ KPIs.

### 4C. LOY-03: AI Loyalty Recommendations
New `loyalty_member_purchase_profiles` table + `rebuild_loyalty_purchase_profile()` RPC. New `ai-loyalty-recommendations` edge function using Gemini. `LoyaltyRecommendations.tsx` widget.

### 4D. LOY-04: QR Code + Printable Card
Install `qrcode` package. Create `loyalty-qr.ts` utility + `LoyaltyCardPrint.tsx` component (85.6×54mm credit-card size). QR encodes card_number. Bulk print support.

### 4E. LOY-05: POS Scanner Integration
Full end-to-end flow in `PosTerminal.tsx`: QR scan → member lookup → sale → auto-accrue with multiplier rules → display result. Add `loyalty_member_id`, `loyalty_points_earned`, `loyalty_multiplier` columns to `pos_transactions`. Receipt loyalty section.

---

## Routing & Navigation
- New routes: `/compliance/capa`, `/compliance/dsar`, `/super-admin/ai-model-cards`
- Nav items in `TenantLayout.tsx` under Compliance section

## Summary

| Phase | Items | Type |
|-------|-------|------|
| 1 (Infra) | SEC-08 rate limiter, SQ-02 CI/CD, ARCH-01 PDF/A-3 | Migration + edge functions + CI config |
| 2 (Compliance) | QM-03 CAPA, PRIV-03 DSAR, EI-04 BG-7, AI-05 Model Cards | Migrations + pages + edge function edit |
| 3 (Docs) | CLOUD-03, BC-03 | Markdown files only |
| 4 (Loyalty) | LOY-01 through LOY-05 | Migrations + RPCs + edge function + pages + POS integration |

I'll implement phase by phase, waiting for your go-ahead between each.


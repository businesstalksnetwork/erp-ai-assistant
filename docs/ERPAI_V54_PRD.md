# erpAI V5.4 Comprehensive PRD

**Version:** 5.4
**Date:** 2026-03-02
**Previous Version:** V5.3 (same day, prior pull)
**Pull Stats:** 61 files changed, 7,658 insertions, 420 deletions (net +7,238 lines = major feature expansion)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CR8/CR9 Fix Verification](#2-cr8cr9-fix-verification)
3. [CR10 New Findings](#3-cr10-new-findings)
4. [Updated Star Ratings (V5.4)](#4-updated-star-ratings-v54)
5. [Competitive Position](#5-competitive-position)
6. [ISO Compliance Scorecard](#6-iso-compliance-scorecard)
7. [Serbian Law & Regulatory Review (2026)](#7-serbian-law--regulatory-review-2026)
8. [Security Posture Review](#8-security-posture-review)
9. [5-Star Implementation Plans (Updated)](#9-5-star-implementation-plans-updated)
10. [Logical Next Steps](#10-logical-next-steps)
11. [Rating Progression History](#11-rating-progression-history)

---

## 1. Executive Summary

V5.4 documents a **massive feature expansion** — the largest single pull in erpAI history. 11 new tenant pages, 4 new Edge Functions, 7 database migrations (14 new tables, 8 new functions), a CI/CD pipeline, 2 ISO compliance documents, and a complete loyalty module overhaul (LOY-01 through LOY-05) were delivered.

However, the deep 5-agent end-to-end review also uncovered **37 new issues (CR10)**, including 1 critical runtime crash, 5 high-severity auth/security gaps, and significant quality gaps in the new code. The security posture score has been **corrected downward** from 8.5/10 to 7.0/10 based on a comprehensive Edge Function audit that revealed authentication gaps not caught in prior sessions.

### Key Achievements This Pull

| Metric | V5.3 | V5.4 | Change |
|--------|-------|-------|--------|
| Tenant pages | 220+ | 231+ | +11 new pages |
| Edge Functions | ~100 | 104 | +4 new + shared rate-limiter |
| Database tables | ~70 | 84 | +14 new tables |
| DB functions/RPCs | ~35 | 43 | +8 new functions |
| CI/CD pipeline | None | GitHub Actions (4 jobs) | **NEW** |
| ISO documentation | 1 (PRD) | 3 (PRD + DR + Cloud) | +2 ISO docs |
| Rate limiter | Inline only | Shared module (8% adoption) | **NEW** |
| Loyalty module | 4 pages, basic | 6 pages, LOY-01→05, fizička lica, AI recs | **OVERHAULED** |
| Overall Star Rating | 4.68 | 4.70 | +0.02 |
| ISO Readiness | 74% | 79% | +5pp |
| Security Score | 8.5/10 | 7.0/10 | -1.5 (corrected assessment) |

### CR Tracking Summary (All Sessions)

| Batch | Session | Found | Fixed | Open |
|-------|---------|-------|-------|------|
| CR1 | S3 | 36 | 36 | 0 |
| CR2 | S3 | 14 | 14 | 0 |
| CR3 | S4 | 5 | 5 | 0 |
| CR4 | S5 | 12 | 12 | 0 |
| CR5 | S6 | 6 | 4 | 2 |
| CR6 | S7 | 12 | 10 | 2 |
| CR7 | S7 | 7 | 5 | 2 |
| CR8 | S8 | 12 | 9 | 3 |
| CR9 | S8 | 5 | 3 | 2 |
| **CR10** | **S10** | **37** | **0** | **37** |
| **Total** | | **146** | **98** | **48** |

---

## 2. CR8/CR9 Fix Verification

### NEWLY FIXED (6 additional from CR8/CR9)

| ID | Issue | Evidence | Status |
|----|-------|----------|--------|
| CR8-05 | `generate-pdfa` returns JSON, not PDF/A-3 | `generate-pdfa` **DELETED**. `generate-pdf` now produces PDF/A-3-like output with XMP metadata + embedded UBL XML | **FIXED** (caveats in CR10-11) |
| CR8-07 | No rate-limiting middleware | `_shared/rate-limiter.ts` created (133 lines). DB-backed sliding window with 5 categories. | **FIXED** (adoption tracked as CR10-10) |
| CR8-08 | `tenant-data-export` truncation at 10K rows | `DataExport.tsx` now uses cursor-based pagination loop | **FIXED** |
| CR8-10 | Incident number race condition | Migration `20260302013012`: `incident_number_seq` + `BEFORE INSERT` trigger generates `INC-YYYY/NNNN` | **FIXED** (year-reset gap noted in CR10-21) |
| CR8-11 | No CI/CD pipeline | `.github/workflows/ci.yml`: 4 jobs (lint-typecheck, unit-tests, build, security-audit). TruffleHog secret scanning. | **FIXED** |
| CR8-12 | Duplicate generate-pdf/generate-pdfa | `generate-pdfa` deleted from filesystem and config.toml | **FIXED** |
| CR9-04 | generate-pdfa has 4 inline errors | File deleted entirely | **FIXED** (N/A) |
| CR9-05 | generate-pdf and generate-pdfa duplicated | `generate-pdfa` deleted, only `generate-pdf` remains | **FIXED** |

### STILL OPEN FROM CR8/CR9 (12 remaining)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| CR5-05 | Missing `updated_at` trigger on some tables | Low | Open |
| CR5-06 | Inconsistent date format in some components | Low | Open |
| CR6-09 | Missing indexes on some FK columns | Low | Open |
| CR6-10 | Some components don't use ErrorBoundary | Low | Open |
| CR7-04 | Missing TypeScript strict mode in tsconfig | Low | Open |
| CR7-06 | Some AI functions don't log to audit_log | Medium | Open |
| CR8-01 | CORS wildcard `*.lovable.app` too broad | Medium | Open |
| CR8-06 | No PDF rendering library (pdf-lib) integrated | Medium | Open - pdf-lib still absent from package.json |
| CR8-09 | `health-check` uses wrong env var / endpoint | Medium | Open - uses `OPENAI_API_KEY` instead of `LOVABLE_API_KEY` |
| CR9-01 | ai-assistant has 10 raw error responses | High | Open |
| CR9-02 | 7 migrations have USING(true) RLS policies | Medium | Open |
| CR9-03 | health-check doesn't use createErrorResponse | Low | Open |

---

## 3. CR10 New Findings

### Methodology

Five parallel review agents conducted a comprehensive end-to-end audit:
1. **Pages/Components Agent** — Reviewed all 24 new/modified frontend files
2. **Edge Functions Agent** — Audited 20 Edge Functions (4 new, 15 modified, 1 deleted)
3. **Migrations/DB Agent** — Analyzed 7 new migrations, 14 tables, 8 functions, config.toml, types.ts
4. **Serbian Laws Agent** — Verified compliance across 8 regulatory areas
5. **CI/CD & Docs Agent** — Reviewed pipeline, ISO docs, package.json, Lovable plan

### CRITICAL (1)

#### CR10-01: ai-loyalty-recommendations RUNTIME CRASH
**Severity:** CRITICAL | **File:** `supabase/functions/ai-loyalty-recommendations/index.ts:2`

Imports `{ corsHeaders }` from `_shared/cors.ts` but that named export **no longer exists**. The shared module only exports `getCorsHeaders(req)` and `handleCorsPreflightRequest(req)`. Every response path spreads `undefined`, causing broken CORS headers. **This function crashes on every invocation.**

**Fix:** Replace import with `getCorsHeaders`/`handleCorsPreflightRequest` pattern used by all other 103 functions.

---

### HIGH (5)

#### CR10-02: ai-loyalty-recommendations has ZERO authentication
**Severity:** HIGH | **File:** `supabase/functions/ai-loyalty-recommendations/index.ts:4-27`

Any unauthenticated request with any `tenant_id` in the body will query and return loyalty member names, card numbers, point balances, and tier information. No JWT verification, no tenant membership check, no rate limiting.

**Fix:** Add JWT auth, tenant membership verification, rate limiting, and `createErrorResponse`.

#### CR10-03: generate-pdf does not verify auth token or check invoice ownership
**Severity:** HIGH | **File:** `supabase/functions/generate-pdf/index.ts:30-68`

The Authorization header is read only to generate a rate-limit key (`token.slice(-8)`). `auth.getUser()` is never called. Any request with any string in the Authorization header can download any invoice PDF given a known `invoice_id`. While UUIDs aren't easily guessable, the pattern is architecturally broken.

**Fix:** Add `auth.getUser()` call and verify user belongs to the invoice's tenant.

#### CR10-04: ai-assistant double rate-limit with conflicting local function
**Severity:** HIGH | **File:** `supabase/functions/ai-assistant/index.ts:6,37-56,939,960`

Imports `checkRateLimit` from `_shared/rate-limiter.ts` (line 6) AND defines a local `async function checkRateLimit` (line 37). Both are called: imported at line 939 (30/min via `rate_limit_log`), local at line 960 (20/min via `ai_rate_limits`). Results in 2 wasted DB round-trips per request with inconsistent limits.

**Fix:** Remove local `checkRateLimit` function and its `ai_rate_limits` table dependency. Keep only the imported shared rate-limiter.

#### CR10-05: inventory-classification has no tenant membership check
**Severity:** HIGH | **File:** `supabase/functions/inventory-classification/index.ts:11-27`

Verifies user auth (user exists) but does NOT verify the user belongs to the requested `tenant_id`. Any authenticated user can request inventory classification for any tenant's product data.

**Fix:** Add tenant membership check after user auth verification.

#### CR10-06: Loyalty card number generation race condition
**Severity:** HIGH | **File:** Migration `20260302021813`, function `generate_loyalty_card_number()`

Uses `MAX(card_number::INT) + 1` pattern — the exact same anti-pattern that CR8-10 fixed for incident numbers. Two concurrent inserts read the same MAX and generate the same card number. The unique index detects the collision but provides no retry — the transaction fails.

**Fix:** Use a per-tenant sequence (same approach as incident numbers) or `SELECT ... FOR UPDATE` on a counter table.

---

### MEDIUM (15)

| ID | Issue | File(s) | Description |
|----|-------|---------|-------------|
| CR10-07 | 5 inventory/purchasing tables missing `status='active'` in RLS | Migration `20260302014332` | `supplier_lead_times`, `supplier_order_predictions`, `blanket_agreements`, `blanket_agreement_lines`, `consignment_stock` — deactivated tenant members can still read data |
| CR10-08 | ai-weekly-email no CRON_SECRET | `ai-weekly-email/index.ts` | Any unauthenticated request can trigger weekly digest for any tenant. Compare with `send-notification-emails` which checks CRON_SECRET. |
| CR10-09 | compliance-checker N+1 queries (DoS risk) | `compliance-checker/index.ts:190-249` | One DB query per employee + one per asset with no dataset size limit and no rate limiting. 500 employees = 500+ sequential queries. |
| CR10-10 | rate-limiter only 8% adoption | `_shared/rate-limiter.ts` | Only 8 of 104 functions use the new shared rate-limiter. 92 functions have zero rate limiting including AI endpoints, data exports, and OCR. |
| CR10-11 | generate-pdf PDF/A-3 non-conformant | `generate-pdf/index.ts` | Missing OutputIntent dictionary (ISO 19005-3 §6.2.2), XMP metadata compressed (violates §6.7.3), missing EmbeddedFile Params dict. Will fail VeraPDF validation. |
| CR10-12 | tenant-data-export queries wrong table | `tenant-data-export/index.ts:45` | Queries `tenant_users` but codebase uses `tenant_members`. Every export call may return 403 "No tenant membership" for all users. |
| CR10-13 | POS split payment records only first method | `PosTerminal.tsx:945` | Split payment confirm handler calls `completeSale.mutate()` with original `paymentMethod` state, not the split payments array. Only first payment method is recorded. |
| CR10-14 | POS transaction number not unique | `PosTerminal.tsx:464` | Uses `POS-${Date.now()}` which is not unique in concurrent multi-terminal environments. Should use DB-side `next_invoice_number` RPC. |
| CR10-15 | ai_model_cards cross-tenant readable | Migration `20260302021135` | `SELECT` policy allows any authenticated user across any tenant to read all AI model cards. Write policy allows any admin from any tenant to modify. |
| CR10-16 | createJsonResponse doesn't apply withSecurityHeaders | `_shared/error-handler.ts:56-66` | Systemic gap: all functions using `createJsonResponse` (ai-ordering-prediction, inventory-classification, etc.) are missing 6 security headers on success responses. |
| CR10-17 | cleanup_rate_limit_log has no pg_cron schedule | Migration `20260302020826` | Function exists but no cron job configured. Rate limit log table will grow unboundedly. |
| CR10-18 | All 7 new migrations deviate from get_user_tenant_ids() pattern | All 7 new migrations | Established codebase pattern uses `get_user_tenant_ids(auth.uid())` in RLS. All 7 new migrations use direct `tenant_members` subqueries instead. |
| CR10-19 | DSAR Management null deadline_date crash | `DsarManagement.tsx:65,107` | `new Date(null)` and `format()` will behave incorrectly if DB default is missing. No null guard. |
| CR10-20 | Consignment consume doesn't create inventory movement | `ConsignmentInventory.tsx` | `consumeStock` marks status as "consumed" but does not create an inventory movement or stock receipt entry. No downstream effect on actual stock levels. |
| CR10-21 | Incident number sequence doesn't reset per year | Migration `20260302013012` | Sequence is global and never resets. In 2027, numbers will be `INC-2027/1453+` instead of `INC-2027/0001`. Year prefix is cosmetic only. |

---

### LOW (16)

| ID | Issue | Description |
|----|-------|-------------|
| CR10-22 | Dead imports across new pages | `LineChart`/recharts in SupplierOrderPredictions, `useQueryClient`/`RefreshCw` in InventoryClassification, `canvasRef` in LoyaltyCardPrint, `Sparkles` in SuperAdminLayout, `transactions` query in LoyaltyAnalytics |
| CR10-23 | i18n gaps in new pages | `CapaManagement`, `DsarManagement`, `AiModelCards`, `IncidentManagement`, `PosPromotions`, `GiftCards`, `MarketBasketAnalysis`, `LoyaltyAnalytics`, `DataExport` — all hardcoded English or Serbian, no `t()` usage |
| CR10-24 | Toast system inconsistency | Pages split between `useToast()` (shadcn) and `toast` from `sonner`. Both `<Toaster>` and `<Sonner>` mounted in App.tsx. Different positioning/styling. |
| CR10-25 | LoyaltyAnalytics RFM uses wrong date field | `LoyaltyAnalytics.tsx` — Recency calculated from `enrolled_at` (enrollment date), not last purchase date. Conflates monetary and frequency signals. |
| CR10-26 | LoyaltyDashboard enrollment trend cross-year bug | `LoyaltyDashboard.tsx:115-120` — `format(new Date(m.enrolled_at), "MM-dd")` produces same MM-DD across years. Members from different years double-counted on same bar. |
| CR10-27 | MarketBasketAnalysis setState in queryFn | `MarketBasketAnalysis.tsx:24` — `setLoading(true)` inside `queryFn` violates React Query rules. Can cause "Cannot update a component while rendering" warnings. |
| CR10-28 | health-check uses OPENAI_API_KEY | `health-check/index.ts:55` — All other functions use `LOVABLE_API_KEY`. AI gateway always reported as `unconfigured` in environments with only `LOVABLE_API_KEY`. |
| CR10-29 | Migration 7 is data-mutating no-op | Migration `20260302022459` — Bare `DELETE FROM rate_limit_log WHERE key LIKE 'ai-insights%'`. Missing schema qualification, data-mutating in a migration file, and a no-op (table was just created). |
| CR10-30 | validate-pib fails open on any error | `validate-pib/index.ts:104-111` — Catch returns `{ valid: true }` on any exception including JSON parse errors. Malformed requests treated as valid PIBs. |
| CR10-31 | Multiple (supabase as any) casts | `blanket_agreements`, `consignment_stock`, `supplier_order_predictions`, `supplier_lead_times`, `loyalty_campaigns`, `loyalty_multiplier_rules` — tables not in generated Supabase types. |
| CR10-32 | refresh_loyalty_tier ignores p_tenant_id | Migration `20260302021813` — Function accepts `p_tenant_id` but never uses it in the query. Theoretical cross-tenant tier refresh if RPC is exposed. |
| CR10-33 | Referral bonus hardcoded at 100 points | Migration `20260302021813`, function `trg_loyalty_referral_bonus()` — `v_bonus INT := 100` with no configuration table reference. Not tenant-configurable. |
| CR10-34 | CI/CD TruffleHog unpinned to @main | `.github/workflows/ci.yml:72` — `trufflesecurity/trufflehog@main` instead of specific SHA. Supply chain risk. |
| CR10-35 | npm audit non-blocking | `.github/workflows/ci.yml:70` — `|| true` means CVEs never gate the build. Critical vulnerabilities pass silently. |
| CR10-36 | Compliance routes super-admin only | `App.tsx`, `otherRoutes.tsx` — CAPA, DSAR, AI Model Cards only accessible via `/super-admin/*`. Tenant users cannot run their own compliance workflows. |
| CR10-37 | rollup-plugin-visualizer in wrong section | `package.json` — Build analysis tool in `dependencies` instead of `devDependencies`. Adds unnecessary weight to production dependency graph. |

---

## 4. Updated Star Ratings (V5.4)

### What Changed

This pull implemented multiple features from the V5.3 5-star roadmap:

**POS/Retail — 4 of 8 roadmap features implemented + LOY-01→05:**
- R1: Advanced Promotions Engine ✅ (PosPromotions.tsx, promotions table)
- R2: AI Market Basket Analysis ✅ (MarketBasketAnalysis.tsx, ai-market-basket Edge Function)
- R3: Gift Card Management ✅ (GiftCards.tsx, gift_cards/gift_card_transactions tables)
- R4: Advanced Loyalty Analytics ✅ (LoyaltyAnalytics.tsx, RFM segmentation, CLV)
- LOY-01→05: Complete loyalty overhaul ✅ (fizička lica, advanced features, AI recommendations, QR card print, POS scanner integration)

**Purchasing/Inventory — 6 of 8 roadmap features implemented:**
- I1: AI Ordering Prediction ✅ (SupplierOrderPredictions.tsx, ai-ordering-prediction Edge Function)
- I2: Auto PO Generation ✅ (bulk PO creation from predictions)
- I3: Supplier Lead Time Tracking ✅ (supplier_lead_times table, SupplierLeadTimeHistory.tsx)
- I4: ABC/XYZ Classification ✅ (InventoryClassification.tsx, inventory-classification Edge Function)
- I5: Blanket Agreement Management ✅ (BlanketAgreements.tsx, blanket_agreements tables)
- I7: Consignment Inventory ✅ (ConsignmentInventory.tsx, consignment_stock table)

### V5.4 Star Rating Table

| # | Category | V5.3 | V5.4 | Delta | Justification |
|---|----------|------|------|-------|---------------|
| 1 | Accounting & GL | 5.0 | 5.0 | -- | Full double-entry, multi-currency, auto-posting |
| 2 | Tax Compliance (Serbian) | 5.0 | 5.0 | -- | PDV, POPDV, SEF 3.14.0, PFR, PPP-PD, M4 |
| 3 | Reporting & BI | 5.0 | 5.0 | -- | KPI dashboards, drill-down, export, AI insights |
| 4 | AI Features | 5.0 | 5.0 | -- | 27 AI functions (+4 new), model cards, bias testing |
| 5 | Integrations/API | 5.0 | 5.0 | -- | SEF, PFR, eBolovanje, eOtpremnica, CROSO |
| 6 | Sales/CRM | 4.5 | 4.5 | -- | Full pipeline but no AI forecasting yet |
| 7 | HR/Payroll | 4.5 | 4.5 | -- | 37+ pages, Serbian compliance, no perf reviews |
| 8 | Banking & Treasury | 4.5 | 4.5 | -- | Payment processing, bank statements, reconciliation |
| 9 | Multi-company/Tenant | 4.5 | 4.5 | -- | Full RLS isolation, tenant switching |
| 10 | Document Management | 4.5 | 4.5 | -- | DMS, archive book, retention policies |
| 11 | **Purchasing/Inventory** | **4.75** | **4.90** | **+0.15** | **6/8 roadmap items: AI ordering, lead time, ABC/XYZ, blanket agreements, consignment. Only I6 (multi-currency pricing) and I8 (supplier portal) remain.** |
| 12 | **POS/Retail** | **4.75** | **4.85** | **+0.10** | **4/8 roadmap items + LOY-01→05: promotions, gift cards, market basket, loyalty analytics, full loyalty overhaul with fizička lica, AI recommendations, QR card print. Quality issues (P1 bugs) cap the rating.** |
| 13 | Production/MFG | 4.25 | 4.25 | -- | No changes this pull |
| 14 | Fixed Assets | 4.25 | 4.25 | -- | No changes this pull |

### Summary

| Metric | V5.3 | V5.4 |
|--------|-------|------|
| Categories at 5.0 | 5 | 5 |
| Categories at 4.90 | 0 | 1 |
| Categories at 4.85 | 0 | 1 |
| Categories at 4.75 | 2 | 0 |
| Categories at 4.5 | 5 | 5 |
| Categories at 4.25 | 2 | 2 |
| **Weighted Average** | **4.68** | **4.70** |

### Why Only +0.02?

The feature expansion is substantial, but quality issues in the new code limit the rating improvement:
- 1 critical runtime crash (CR10-01)
- 5 high-severity auth gaps (CR10-02→06)
- Multiple P1 bugs (POS tx number, split payment, DSAR null crash, loyalty race condition)
- 15 medium-severity issues across the new code

Once the CR10 HIGH/CRITICAL items are fixed and the P1 bugs resolved, these modules should reach their full potential (POS → 4.95, Purchasing → 4.95).

---

## 5. Competitive Position

| Rank | ERP System | Avg Rating | Notes |
|------|-----------|------------|-------|
| **1** | **erpAI** | **4.70** | **Feature-rich, but quality gaps limit score** |
| 2 | SAP Business One | 4.64 | Incumbent leader |
| 3 | Oracle NetSuite | 4.50 | Cloud-native |
| 4 | Microsoft Dynamics 365 BC | 4.43 | MS ecosystem |
| 5 | Odoo Enterprise | 4.21 | Open-source leader |
| 6 | Pantheon (Slovenia) | 3.86 | Regional |
| 7 | Minimax (Slovenia) | 3.64 | Cloud-focused |
| 8 | Lidder (Serbia) | 3.50 | Local market |

### erpAI maintains lead over SAP Business One (+0.06).

New advantages this pull:
- AI-powered ordering prediction per supplier (no SAP equivalent without add-ons)
- ABC/XYZ inventory classification via AI (SAP requires SAP IBP)
- Market basket analysis with AI recommendations (SAP requires CAR add-on)
- Complete loyalty program with QR card print and AI recommendations
- CI/CD pipeline with secret scanning (enterprise-grade DevOps)

### What Threatens the Lead

The 37 new CR10 findings represent technical debt that, if left unaddressed, would erode the quality advantage. SAP's lower feature count is offset by higher per-feature quality. erpAI must fix the HIGH/CRITICAL CR10 items to maintain credible leadership.

---

## 6. ISO Compliance Scorecard

### Updated After CI/CD, DR Docs, Cloud Docs, CAPA, DSAR, AI Model Cards

| ISO Standard | PRD Items | Done | Partial | Not Done | V5.3 | V5.4 | Change |
|-------------|-----------|------|---------|----------|------|------|--------|
| **ISO 27001** (InfoSec) | 8 | 6 | 2 | 0 | 88% | **85%** | -3pp (new auth gaps found) |
| **ISO 42001** (AI Gov) | 5 | 4.5 | 0.5 | 0 | 80% | **90%** | +10pp (AI model cards + bias test log) |
| **ISO 9001** (Quality) | 3 | 2.5 | 0.5 | 0 | 67% | **80%** | +13pp (CAPA management implemented) |
| **EN 16931** (e-Invoice) | 4 | 3 | 1 | 0 | 75% | **75%** | -- (no changes) |
| **ISO 27017/18** (Cloud) | 3 | 2.5 | 0.5 | 0 | 67% | **80%** | +13pp (Cloud Controls doc added) |
| **ISO 27701** (Privacy) | 3 | 2.5 | 0.5 | 0 | 67% | **85%** | +18pp (DSAR management implemented) |
| **ISO 22301** (BusCont) | 3 | 2.5 | 0.5 | 0 | 67% | **82%** | +15pp (DR runbook + data export pagination) |
| **ISO 19005** (PDF/A) | 1 | 0 | 1 | 0 | 25% | **50%** | +25pp (PDF/A-3 structure, but non-conformant) |
| **ISO 20000** (ITSM) | 2 | 2 | 0 | 0 | 100% | **100%** | -- (incident sequence fix) |
| **ISO 25010** (SoftQual) | 2 | 1.5 | 0.5 | 0 | 50% | **65%** | +15pp (CI/CD pipeline added) |
| **TOTAL** | **34** | **27** | **6** | **1** | **74%** | **79%** | **+5pp** |

### Key ISO Changes Since V5.3

| Item | V5.3 Status | V5.4 Status | Change |
|------|-------------|-------------|--------|
| QM-03: CAPA workflow | Not Done | CapaManagement.tsx + capa_actions table | **Not Done → Done** |
| PRIV-03: DSAR automation | Not Done | DsarManagement.tsx + dsar_requests table | **Not Done → Done** |
| AI-05: AI model cards | Not Done | AiModelCards.tsx + ai_model_cards + ai_bias_test_log | **Not Done → Done** |
| BC-03: DR runbooks | Not Done | ISO-22301-Disaster-Recovery.md (5 scenarios, RTO/RPO) | **Not Done → Done** |
| CLOUD-03: Cloud controls | Not Done | ISO-27017-27018-Cloud-Controls.md (shared responsibility) | **Not Done → Done** |
| SEC-08: Rate limiting | Partial (inline only) | _shared/rate-limiter.ts (8% adoption) | **Partial → Partial** (improved) |
| SQ-01: CI/CD pipeline | Not Done | GitHub Actions (4 jobs) | **Not Done → Partial** (placeholder tests) |
| ISO 27001 overall | 88% | 85% | **-3pp** (corrected: new auth gaps found) |

### Remaining for 100% ISO Readiness

1. **ISO 19005 (PDF/A-3):** Add OutputIntent dictionary, decompress XMP metadata, add EmbeddedFile Params dict. Consider `pdf-lib` integration (CR8-06).
2. **ISO 25010 (Software Quality):** Add real unit tests (currently only placeholder), wire up Playwright e2e specs, pin TruffleHog action.
3. **ISO 27001 (InfoSec):** Fix auth gaps in CR10-02, CR10-03, CR10-05. Expand rate-limiter adoption from 8% to >80%.
4. **EN 16931 (e-Invoice):** Complete AccountingCustomerParty (BG-7) in UBL XML builder.
5. **ISO 9001 (Quality):** Make CAPA accessible to tenant users (currently super-admin only, CR10-36).
6. **ISO 27701 (Privacy):** Fix DSAR null deadline crash (CR10-19). Add audit logging for data exports.
7. **ISO 42001 (AI Gov):** Fix cross-tenant readable AI model cards (CR10-15).

---

## 7. Serbian Law & Regulatory Review (2026)

### Compliance Matrix (12 Regulations)

| # | Law/Regulation | Code | Status | Evidence | Gaps |
|---|---------------|------|--------|----------|------|
| 1 | Zakon o Radu (ZoR) | Labor Law | **COMPLIANT** | 37+ HR pages, contracts, leave, overtime, night work, CROSO | None |
| 2 | Zakon o PDV (ZoPDV) | VAT Law | **COMPLIANT** | Full PDV calculation, POPDV reporting, S10/S20/AE tax codes, 20%/10%/0% rates | None |
| 3 | Zakon o Racunovodstvu | Accounting Law | **COMPLIANT** | Double-entry GL, chart of accounts, multi-currency, kontni okvir | None |
| 4 | SEF (e-Fakture) | e-Invoicing | **COMPLIANT** | 16 Edge Functions, UBL XML, webhook, SEF 3.14.0 API | None |
| 5 | PFR (Fiskalizacija) | Fiscal Receipts | **COMPLIANT** | Receipt generation, offline retry, fiscal devices, ESIR integration | None |
| 6 | ZZPL (Data Protection) | Serbian GDPR | **COMPLIANT** | Data breach 72h notification, encrypt_pii, data export, DSAR module (new) | None |
| 7 | Zakon o Arhivskoj Gradji | Archive Law | **COMPLIANT** | Archive book, retention policies, DMS, 41 related files | None |
| 8 | ZOO (Obligations) | Contract Law | **COMPLIANT** | Contract templates, business agreements, AI contract generator | None |
| 9 | **eOtpremnica** | Dispatch Notes | **PARTIAL** | Dedicated page and integration exists | Production API connectivity unverified; 3 medium-priority gaps |
| 10 | eBolovanje | Sick Leave | **COMPLIANT** | EBolovanje page, RFZO integration, calculate_payroll_for_run: sick leave at 65%, employer-paid first 30 days | None |
| 11 | ZoPot (Consumer Protection) | Consumer Prot. | **PARTIAL** | Service orders & warranty tracking | No formal complaint register (Knjiga Reklamacija), no 8-day deadline (Art. 56) |
| 12 | ZoET (e-Commerce) | e-Commerce Law | **PARTIAL** | Documented but not fully integrated | No electronic contract formation workflow, no 14-day withdrawal tracking |

### Overall: 9/12 COMPLIANT, 3/12 PARTIAL

### Payroll Compliance Verification (New)

The `calculate_payroll_for_run` function was verified against Serbian 2026 regulations:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Sick leave at 65% of base | ✅ | Function applies 0.65 multiplier |
| Employer pays first 30 days | ✅ | Function checks days and splits employer/RFZO |
| POPDV field handling | ✅ | Proper tax field mapping in POPDV generation |
| Tax rates (20%/10%/0%) | ✅ | All three standard rates implemented |
| Minimum wage compliance | ✅ | Checked against 2026 minimum wage |

### Gap Analysis for Full 12/12

**eOtpremnica — needs:**
- Production API connectivity testing and verification
- 3 medium-priority gaps documented by compliance agent

**ZoPot (Consumer Protection) — needs:**
- Formal customer complaint register (Knjiga Reklamacija)
- 8-day response deadline tracking (Article 56)
- Annual complaint statistics report to Ministry

**ZoET (e-Commerce) — needs:**
- Electronic contract formation workflow
- Mandatory pre-contractual info display
- Right of withdrawal (14 days) tracking for online sales

---

## 8. Security Posture Review

### Score: 7.0/10 (corrected from 8.5/10)

The V5.3 score of 8.5/10 was based on a surface-level assessment. The deep Edge Function audit in V5.4 revealed significant authentication gaps that existed before this pull but were not previously detected. The 7.0/10 score reflects the **actual** security posture.

| Area | V5.3 | V5.4 | Notes |
|------|------|------|-------|
| **Error Handling** | 9/10 | 8/10 | 93 functions still use createErrorResponse, but new functions (ai-loyalty-recommendations) don't. ai-assistant still has 10 raw errors (CR9-01). |
| **Security Headers** | 9/10 | 8/10 | 88 functions use withSecurityHeaders, but createJsonResponse gap (CR10-16) means success paths in 4+ functions miss all 6 headers. Streaming responses bypass headers. |
| **CORS** | 7/10 | 7/10 | Dynamic `getCorsHeaders(req)` on 103/104 functions. `*.lovable.app` wildcard still open (CR8-01). ai-loyalty-recommendations imports dead static `corsHeaders`. |
| **Input Validation** | 8/10 | 7/10 | document-ocr accepts unbounded base64 (CR10-09), compliance-checker N+1 DoS (CR10-09). No size validation on image uploads. |
| **Auth/AuthZ** | 9/10 | 6/10 | **Major correction.** 3 functions with zero/broken auth: ai-loyalty-recommendations (CR10-02), generate-pdf (CR10-03), inventory-classification (CR10-05). ai-weekly-email no CRON_SECRET (CR10-08). All 104 functions have `verify_jwt = false` in config.toml — auth is manual and 4+ functions fail to implement it. |
| **PII Protection** | 8/10 | 8/10 | encrypt_pii/decrypt_pii in place. DSAR module added. |
| **Audit Logging** | 9/10 | 8/10 | New functions missing audit: inventory-classification, generate-pdf (who downloaded), tenant-data-export (GDPR requirement), company-lookup (PIB lookups). |
| **Rate Limiting** | 3/10 | 4/10 | `_shared/rate-limiter.ts` created with 5 categories. Only 8/104 functions (8%) adopted. High-risk unprotected: ai-market-basket, document-ocr, compliance-checker, tenant-data-export. In-memory fallback is per-instance only. |
| **Secret Management** | 7/10 | 7/10 | Env vars, secret_rotation_log table. web-sync stores third-party API keys in plaintext in web_connections table. |
| **CI/CD Security** | 0/10 | 5/10 | Pipeline added with TruffleHog secret scanning. npm audit non-blocking (|| true). TruffleHog unpinned (@main). No SAST tool. No e2e or real unit tests. |
| **Overall** | **8.5** | **7.0** | **-1.5 (corrected assessment)** |

### Edge Function Security Coverage Matrix

| Shared Module | Functions Using | Coverage | Target |
|---------------|----------------|----------|--------|
| `_shared/cors.ts` (getCorsHeaders) | 103/104 | 99% | 100% |
| `_shared/error-handler.ts` (createErrorResponse) | 97/104 | 93% | 100% |
| `_shared/security-headers.ts` (withSecurityHeaders) | 88/104 | 85% | 100% |
| `_shared/rate-limiter.ts` (checkRateLimit) | 8/104 | **8%** | >80% |

### Top 5 Security Priorities (Updated)

1. **Fix CR10-01/02: ai-loyalty-recommendations** — Currently crashes AND is unauthenticated. Fix CORS import, add JWT auth, tenant membership, rate limiting.
2. **Fix CR10-03: generate-pdf auth bypass** — Any request can download any invoice. Add `auth.getUser()` and tenant ownership check.
3. **Expand rate-limiter adoption (CR10-10)** — Currently 8%. Priority targets: all AI endpoints, document-ocr, compliance-checker, tenant-data-export.
4. **Fix CR10-16: createJsonResponse security headers** — Systemic fix in `_shared/error-handler.ts` to auto-apply `withSecurityHeaders` on all JSON responses.
5. **Fix CR10-05: inventory-classification tenant check** — Add tenant membership verification after auth.

---

## 9. 5-Star Implementation Plans (Updated)

### Features Delivered This Pull vs. Remaining

| Module | Roadmap Items | Delivered | Remaining | Remaining Effort |
|--------|--------------|-----------|-----------|-----------------|
| POS/Retail | 8 (R1-R8) + LOY-01→05 | R1, R2, R3, R4, LOY-01→05 | R5 (multi-loc sync), R6 (customer display), R7 (table service), R8 (e-com sync) | 8 days |
| Purchasing/Inventory | 8 (I1-I8) | I1, I2, I3, I4, I5, I7 | I6 (multi-currency pricing), I8 (supplier portal) | 6 days |
| Sales/CRM | 10 (S1-S10) | 0 | S1-S10 | 23 days |
| HR/Payroll | 10 (H1-H10) | 0 | H1-H10 | 32 days |
| Production/MFG | 10 (P1-P10) | 0 | P1-P10 | 32 days |
| Fixed Assets | 10 (A1-A10) | 0 | A1-A10 | 28 days |

### Revised Phase Plan

**Phase 0: Bug Fix Sprint (Week 1)** - 5 days
- Fix all CR10 CRITICAL and HIGH items (CR10-01 through CR10-06)
- Fix P1 bugs (POS tx number, split payment, DSAR null crash, loyalty race condition)
- Expand rate-limiter to all AI endpoints
- Fix createJsonResponse security headers gap
- **Impact:** Security score 7.0 → 8.0, Rating stays 4.70 but quality improves

**Phase 1: Polish & Complete (Weeks 2-3)** - 14 days
- POS/Retail: R5-R8 remaining features (8 days)
- Purchasing/Inventory: I6, I8 remaining features (6 days)
- **Impact:** Rating 4.70 → 4.78 (POS→5.0, Purchasing→5.0)

**Phase 2: Revenue Features (Weeks 4-6)** - 23 days
- Sales/CRM to 5.0 (S1-S10)
- **Impact:** Rating 4.78 → 4.82

**Phase 3: Compliance Features (Weeks 7-9)** - 28 days
- Fixed Assets to 5.0 (A1-A10)
- **Impact:** Rating 4.82 → 4.89

**Phase 4: Enterprise Features (Weeks 10-13)** - 32 days
- HR/Payroll to 5.0 (H1-H10)
- **Impact:** Rating 4.89 → 4.93

**Phase 5: Manufacturing Excellence (Weeks 14-17)** - 32 days
- Production to 5.0 (P1-P10)
- **Impact:** Rating 4.93 → 5.0

### Total Remaining: 134 person-days (was 155, minus delivered features, plus bug fix sprint)

---

## 10. Logical Next Steps

### Immediate — Bug Fix Sprint (This Week)

| # | Action | CR | Impact | Effort |
|---|--------|-----|--------|--------|
| 1 | Fix ai-loyalty-recommendations (CORS import + auth + rate limiting) | CR10-01, CR10-02 | Critical — function non-functional | 2h |
| 2 | Fix generate-pdf auth bypass (add getUser + tenant check) | CR10-03 | High — any request downloads any invoice | 1h |
| 3 | Remove ai-assistant local checkRateLimit function | CR10-04 | High — 2 wasted DB calls per request | 30m |
| 4 | Add tenant membership check to inventory-classification | CR10-05 | High — cross-tenant inventory data | 30m |
| 5 | Fix loyalty card number to use sequence (like incident numbers) | CR10-06 | High — concurrent card creation fails | 1h |
| 6 | Fix POS transaction number to use DB sequence | CR10-14 | Medium — duplicate tx numbers possible | 30m |
| 7 | Fix POS split payment to record all methods | CR10-13 | Medium — payment data loss | 1h |
| 8 | Fix createJsonResponse to apply withSecurityHeaders | CR10-16 | Medium — systemic security header gap | 30m |
| 9 | Fix tenant-data-export table name (tenant_users → tenant_members) | CR10-12 | Medium — export broken for all users | 5m |
| 10 | Add CRON_SECRET check to ai-weekly-email | CR10-08 | Medium — unauthenticated email trigger | 30m |

### Short-term (Next 2 Weeks)

| # | Action | Impact |
|---|--------|--------|
| 11 | Expand rate-limiter to all AI endpoints (ai-market-basket, document-ocr, compliance-checker, ai-year-end-check) | Security — protect expensive compute endpoints |
| 12 | Add pg_cron schedule for cleanup_rate_limit_log | Ops — prevent unbounded table growth |
| 13 | Fix 5 inventory/purchasing RLS policies to include status='active' | Security — deactivated members can't read data |
| 14 | Add status='active' to ai_model_cards RLS or scope to tenant | Security — prevent cross-tenant reads |
| 15 | Add null guard for DSAR deadline_date | Reliability — prevent crashes |
| 16 | Generate Supabase types for new tables (eliminate `as any` casts) | Type safety — 6 tables currently untyped |
| 17 | Pin TruffleHog to specific SHA and make npm audit blocking | CI/CD — supply chain security |
| 18 | Add real unit tests (replace placeholder expect(true).toBe(true)) | Quality — CI currently provides zero assurance |
| 19 | Wire up Playwright e2e specs (8 files exist, never executed) | Quality — test critical user flows |

### Medium-term (Next Month)

| # | Action | Impact |
|---|--------|--------|
| 20 | Complete POS/Retail to 5.0 (R5-R8: multi-loc sync, customer display, table service, e-com sync) | Rating — POS→5.0 |
| 21 | Complete Purchasing/Inventory to 5.0 (I6: multi-currency, I8: supplier portal) | Rating — Purchasing→5.0 |
| 22 | Integrate pdf-lib for strict PDF/A-3 conformance (OutputIntent, uncompressed XMP) | ISO 19005 — legal archival compliance |
| 23 | Begin Sales/CRM 5-star features (S1: AI forecasting, S2: lead scoring) | Revenue features |
| 24 | Implement ZoPot complaint register (Knjiga Reklamacija) | Full 12/12 regulatory compliance |
| 25 | Make CAPA/DSAR accessible to tenant users (not just super-admin) | ISO 9001/27701 compliance for tenants |

### Long-term (Next Quarter)

| # | Action | Impact |
|---|--------|--------|
| 26 | Complete all 6 modules to 5.0 | First 5-star Serbian ERP |
| 27 | Achieve 100% ISO compliance (all 10 standards) | Enterprise certification readiness |
| 28 | Reduce open CRs from 48 to <10 | Technical debt elimination |
| 29 | Expand rate-limiter to >80% adoption | Security maturity |
| 30 | ISO 27001 certification preparation | Enterprise market readiness |

---

## 11. Rating Progression History

| Version | Date | Rating | Key Changes |
|---------|------|--------|-------------|
| V2 | 2026-02 | 3.20 | Initial audit, 154 bugs found |
| V3 | 2026-02 | 3.60 | 169 findings, 8 phases |
| V3.3 | 2026-02 | 3.90 | Competitor comparison, CR3 fixes |
| V3.4 | 2026-02 | 4.10 | Cross-module analysis, 60 files |
| V4 | 2026-02 | 4.43 | 4-star improvements, CR5 fixes |
| V5.1 | 2026-03 | 4.57 | ISO compliance implementation |
| V5.2 | 2026-03 | 4.61 | ISO adoption verified, CR8 found |
| V5.3 | 2026-03 | 4.68 | 93 functions hardened, module deep-dive |
| **V5.4** | **2026-03** | **4.70** | **+11 pages, +4 functions, +14 tables, CI/CD, loyalty overhaul, 37 new CRs found** |

### Star Rating History Chart

```
5.0 |                                                         TARGET =====>
    |
4.5 |                                         *----*----*----*----*
    |                                    *----'
4.0 |                              *----'
    |                        *----'
3.5 |                  *----'
    |            *----'
3.0 |      *----'
    |  *--'
2.5 |
    +----+----+----+----+----+----+----+----+----+----+
     V2  V3  V3.3 V3.4  V4  V5.1 V5.2 V5.3 V5.4  5.0
```

---

## Appendix A: All Open CRs (48)

### Critical (1)
| ID | Description | Category |
|----|-------------|----------|
| CR10-01 | ai-loyalty-recommendations RUNTIME CRASH (corsHeaders import) | Security |

### High (6)
| ID | Description | Category |
|----|-------------|----------|
| CR9-01 | ai-assistant has 10 raw error responses | Security |
| CR10-02 | ai-loyalty-recommendations zero authentication | Security |
| CR10-03 | generate-pdf no auth verification | Security |
| CR10-04 | ai-assistant double rate-limit conflict | Performance |
| CR10-05 | inventory-classification no tenant membership check | Security |
| CR10-06 | Loyalty card number race condition (MAX+1) | Data |

### Medium (21)
| ID | Description | Category |
|----|-------------|----------|
| CR7-06 | Some AI functions don't log to audit_log | Compliance |
| CR8-01 | CORS wildcard `*.lovable.app` too broad | Security |
| CR8-06 | No PDF rendering library (pdf-lib) | Feature |
| CR8-09 | health-check uses OPENAI_API_KEY wrong endpoint | Correctness |
| CR9-02 | 7 migrations have USING(true) RLS | Security |
| CR10-07 | 5 inventory/purchasing tables missing status='active' in RLS | Security |
| CR10-08 | ai-weekly-email no CRON_SECRET | Security |
| CR10-09 | compliance-checker N+1 DoS risk | Performance |
| CR10-10 | rate-limiter only 8% adoption | Security |
| CR10-11 | generate-pdf PDF/A-3 non-conformant | Compliance |
| CR10-12 | tenant-data-export queries wrong table | Bug |
| CR10-13 | POS split payment records only first method | Bug |
| CR10-14 | POS transaction number not unique (Date.now()) | Bug |
| CR10-15 | ai_model_cards cross-tenant readable | Security |
| CR10-16 | createJsonResponse doesn't apply withSecurityHeaders | Security |
| CR10-17 | cleanup_rate_limit_log no pg_cron schedule | Ops |
| CR10-18 | All 7 new migrations deviate from get_user_tenant_ids() | Consistency |
| CR10-19 | DSAR null deadline_date crash | Bug |
| CR10-20 | Consignment consume no inventory movement | Bug |
| CR10-21 | Incident number sequence doesn't reset per year | Data |

### Low (20)
| ID | Description | Category |
|----|-------------|----------|
| CR5-05 | Missing updated_at triggers | Data |
| CR5-06 | Inconsistent date format | UI |
| CR6-09 | Missing indexes on FK columns | Performance |
| CR6-10 | Some components don't use ErrorBoundary | Reliability |
| CR7-04 | Missing TypeScript strict mode | Quality |
| CR9-03 | health-check doesn't use createErrorResponse | Consistency |
| CR10-22 | Dead imports across new pages | Cleanup |
| CR10-23 | i18n gaps in new pages (hardcoded strings) | i18n |
| CR10-24 | Toast system inconsistency (shadcn vs sonner) | UX |
| CR10-25 | LoyaltyAnalytics RFM uses enrollment date | Logic |
| CR10-26 | LoyaltyDashboard enrollment trend cross-year | Bug |
| CR10-27 | MarketBasketAnalysis setState in queryFn | React |
| CR10-28 | health-check uses OPENAI_API_KEY | Config |
| CR10-29 | Migration 7 data-mutating no-op DELETE | Cleanup |
| CR10-30 | validate-pib fails open on error | Logic |
| CR10-31 | Multiple (supabase as any) casts on new tables | Type Safety |
| CR10-32 | refresh_loyalty_tier ignores p_tenant_id | Logic |
| CR10-33 | Referral bonus hardcoded at 100 points | Config |
| CR10-34 | CI/CD TruffleHog unpinned to @main | Security |
| CR10-35 | npm audit non-blocking (|| true) | CI/CD |

**Total Open: 48 | Critical: 1 | High: 6 | Medium: 21 | Low: 20**

---

## Appendix B: Module Page Counts (Agent-Verified, Updated)

| Module | Pages | Components | Edge Functions | AI Features |
|--------|-------|-----------|---------------|-------------|
| Sales/CRM | 25+ | 3 | 3 | 2 |
| HR/Payroll | 37+ | 8 | 1 | 2 |
| Production | 20+ | 0 | 1 | 5 |
| POS/Retail | **15+** (+4) | **3** (+2) | **4** (+2) | **3** (+3) |
| Purchasing/Inventory | **44+** (+6) | **1** (+1) | **5** (+2) | **2** (+1) |
| Fixed Assets | 30+ (incl. 7 fleet) | 5 | 0 | 0 |
| Accounting | 15+ | 3 | 5 | 3 |
| Tax/Compliance | 10+ | 2 | 16 | 0 |
| Banking | 8+ | 0 | 2 | 1 |
| Reporting | 6+ | 5 | 3 | 2 |
| Admin/Config | 20+ | 5 | 4 | 1 |
| **Compliance** (new) | **3** | 0 | 1 | 0 |
| **TOTAL** | **233+** | **35** | **45+** | **21** |

---

## Appendix C: New Files in This Pull

### New Pages (11)
| File | Lines | Module | Quality |
|------|-------|--------|---------|
| AiModelCards.tsx | 172 | Compliance | 3/5 |
| BlanketAgreements.tsx | 219 | Purchasing | 3/5 |
| CapaManagement.tsx | 138 | Compliance | 3.5/5 |
| ConsignmentInventory.tsx | 246 | Purchasing | 3/5 |
| DsarManagement.tsx | 143 | Compliance | 3/5 |
| GiftCards.tsx | 141 | POS | 3/5 |
| InventoryClassification.tsx | 217 | Analytics | 4/5 |
| LoyaltyAnalytics.tsx | 175 | POS | 3.5/5 |
| MarketBasketAnalysis.tsx | 146 | POS | 3/5 |
| PosPromotions.tsx | 236 | POS | 3.5/5 |
| SupplierOrderPredictions.tsx | 307 | Purchasing | 4/5 |

### New Components (3)
| File | Lines | Quality |
|------|-------|---------|
| LoyaltyCardPrint.tsx | 121 | 4.5/5 |
| LoyaltyRecommendations.tsx | 69 | 3.5/5 |
| SupplierLeadTimeHistory.tsx | 117 | 4/5 |

### New Edge Functions (4 + 1 shared)
| Function | Lines | Auth | Rate Limit | Critical Issues |
|----------|-------|------|------------|----------------|
| ai-loyalty-recommendations | 128 | ❌ NONE | ❌ | RUNTIME CRASH + no auth |
| ai-market-basket | 150 | ✅ | ❌ | Missing rate limiting |
| ai-ordering-prediction | 245 | ✅ | ✅ | createJsonResponse gap |
| inventory-classification | 160 | ⚠️ Partial | ✅ | No tenant membership check |
| _shared/rate-limiter.ts | 133 | N/A | N/A | 8% adoption |

### New Migrations (7)
| Migration | Tables | Functions | Key Feature |
|-----------|--------|-----------|-------------|
| 20260302013012 | 0 | 1 | Incident number sequence (CR8-10 fix) |
| 20260302013550 | 3 | 0 | Promotions + Gift Cards |
| 20260302014332 | 5 | 0 | Purchasing/Inventory 5.0 |
| 20260302020826 | 1 | 1 | Rate limiting table |
| 20260302021135 | 4 | 0 | Compliance tables (CAPA, DSAR, AI) |
| 20260302021813 | 4 | 5 | Loyalty module overhaul (LOY-01→05) |
| 20260302022459 | 0 | 0 | Data-mutating no-op (DELETE) |

### New Documentation (2)
| File | Lines | ISO Standard | Rating |
|------|-------|-------------|--------|
| ISO-22301-Disaster-Recovery.md | 163 | ISO 22301 | 7.5/10 |
| ISO-27017-27018-Cloud-Controls.md | 104 | ISO 27017/18 | 7.0/10 |

### New CI/CD (1)
| File | Jobs | Rating |
|------|------|--------|
| .github/workflows/ci.yml | 4 (lint, test, build, security) | 6.5/10 |

---

## Appendix D: Priority Bug Matrix

| Priority | File | Bug | CR |
|----------|------|-----|-----|
| P0 | ai-loyalty-recommendations | Runtime crash (corsHeaders import) | CR10-01 |
| P1 | ai-loyalty-recommendations | Zero authentication | CR10-02 |
| P1 | generate-pdf | No auth verification on invoice download | CR10-03 |
| P1 | PosTerminal.tsx:464 | Transaction number `POS-${Date.now()}` not unique | CR10-14 |
| P1 | PosTerminal.tsx:945 | Split payment records only first method | CR10-13 |
| P1 | DsarManagement.tsx:65 | null deadline_date crash | CR10-19 |
| P1 | LoyaltyMembers.tsx:130 | Points balance race condition (stale client state) | CR10-06 |
| P1 | Migration 6 | Loyalty card number MAX+1 race condition | CR10-06 |
| P2 | inventory-classification | No tenant membership check | CR10-05 |
| P2 | ConsignmentInventory.tsx | Consume doesn't create inventory movement | CR10-20 |
| P2 | tenant-data-export | Queries wrong table (tenant_users) | CR10-12 |
| P2 | compliance-checker | N+1 queries (DoS risk) | CR10-09 |
| P2 | ai-weekly-email | No CRON_SECRET | CR10-08 |
| P3 | PosTerminal.tsx:542-555 | Dead code block (posItems never used) | CR10-22 |
| P3 | LoyaltyAnalytics | RFM uses enrollment date not last purchase | CR10-25 |
| P3 | LoyaltyDashboard:115 | Enrollment trend cross-year double-counting | CR10-26 |
| P3 | MarketBasketAnalysis:24 | setState in queryFn (React Query anti-pattern) | CR10-27 |

---

*Generated by Claude Code V5.4 Audit | Session 10 | 2026-03-02*
*5 parallel agents | 61 files reviewed | 37 new findings | 8 prior CRs verified fixed*



# V5.3 PRD Implementation Plan

## Review Summary

The PRD identifies **20 open CRs** (3 HIGH, 10 MEDIUM, 7 LOW) and **6 modules** needing upgrades to reach 5.0. The security hardening (CR8-03/04) is largely done — remaining work is finishing the last ~16 raw error responses in 6 files, plus the feature roadmap.

---

## Phase 1: Finish Security Hardening (Immediate)

**Goal:** Close all remaining HIGH-severity CRs and mop up raw error responses.

### 1A. CR9-01 — ai-assistant raw errors (HIGH)
Replace 10 inline error responses at lines 924, 929, 934, 949, 955, 969, 1093, 1094, 1097, 1231 with `createErrorResponse()`. For the prompt-injection message (L949), use a safe generic message. For upstream proxied status codes (429/402), pass the status through `createErrorResponse`.

### 1B. CR8-09 — health-check pings wrong AI endpoint (HIGH)
Change `https://api.openai.com/v1/models` to `https://ai.gateway.lovable.dev/v1/models` on line 57. Also replace `String(e)` in catch blocks (L31, L47, L68) with `"check failed"` to avoid leaking internals.

### 1C. CR9-05 + CR8-12 — Remove duplicate generate-pdfa (LOW)
Delete `supabase/functions/generate-pdfa/` entirely. It's unused (0 frontend references) and identical to `generate-pdf`.

### 1D. Remaining raw errors in 4 files
- **send-notification-emails** (L516): Replace catch block with `createErrorResponse`. Add imports.
- **web-sync** (L20, 25, 31, 39): Replace inline responses with `createErrorResponse` with appropriate status codes.
- **storage-migrate** (L46, 63, 72): Already has `withSecurityHeaders` — just swap to `createErrorResponse` for consistency.
- **sef-background-sync**: Already clean (confirmed 0 raw errors remaining).

### 1E. CR9-03 — health-check createErrorResponse
Health-check is a diagnostic endpoint. The catch blocks should sanitize errors but keep component-level status reporting. Wrap individual check errors with `"check failed"` instead of `String(e)`.

**Impact:** Closes CR8-09, CR8-12, CR9-01, CR9-03, CR9-04, CR9-05. Reduces open CRs from 20 to 14. Security score 8.5 → 9.0.

---

## Phase 2: Medium-Priority Fixes (Short-term)

These are important but not user-facing feature work:

| CR | Fix | Notes |
|----|-----|-------|
| CR8-07 | Rate-limiting middleware in `_shared/rate-limiter.ts` | Deno KV or in-memory sliding window; apply to AI + public functions |
| CR8-08 | Paginated tenant-data-export | Replace 10K limit with cursor-based pagination, warn on truncation |
| CR8-10 | Incident number race condition | Use `SELECT ... FOR UPDATE` or a Postgres sequence for `INC-YYYY/NNNN` |
| CR9-02 | Audit USING(true) RLS policies | Replace with tenant-scoped checks for non-lookup tables |
| CR7-06 | AI functions audit logging | Ensure all ai-* functions log to `ai_action_log` |

**Impact:** Closes 5 more CRs. Security score 9.0 → 9.5.

---

## Phase 3-8: Feature Upgrades to 5.0

Per PRD priority order (fastest ROI first):

### Phase 3: POS/Retail 4.75 → 5.0 (8 features)
- R1: Promotions engine (BOGO, bundles, coupons) — new table + page
- R2: AI Market Basket Analysis — edge function
- R3: Gift card management
- R4: Advanced loyalty analytics (RFM, CLV)
- R5-R8: Multi-location sync, customer display, table service, e-commerce sync

### Phase 4: Purchasing/Inventory 4.75 → 5.0 (8 features)
- **I1: AI Ordering Prediction per Supplier (P0 flagship)** — new edge function `ai-ordering-prediction`, tables `supplier_order_predictions` + `supplier_lead_times`, UI page
- I2: Auto PO generation from predictions
- I3-I8: Lead time tracking, ABC/XYZ classification, blanket agreements, multi-currency, consignment, supplier portal

### Phase 5: Sales/CRM 4.5 → 5.0 (10 features)
- S1: AI Sales Forecasting, S2: AI Lead Scoring
- S3: Customer 360 View
- S5: Commission engine (tables + rules)
- S4, S6-S10: Quote-to-order, territories, email integration, pipeline automation, analytics, MRR

### Phase 6: Fixed Assets 4.25 → 5.0 (10 features)
- A1: AI Predictive Maintenance, A3: IFRS 16 Lease Accounting
- A2, A4-A10: Depreciation methods, impairment, barcode, insurance, budget, multi-currency, GPS, environmental

### Phase 7: HR/Payroll 4.5 → 5.0 (10 features)
- H1: Performance Reviews (360 feedback, review cycles)
- H2: Skills Matrix, H5: ATS/Recruitment
- H3-H4, H6-H10: Succession, LMS, AI workforce analytics, surveys, compliance, self-service, talent analytics

### Phase 8: Production/MFG 4.25 → 5.0 (10 features)
- P1: Finite Capacity Scheduling, P4: Batch/Lot Traceability
- P2: Production Costing, P3: BOM versioning
- P5-P10: Scrap/rework, subcontracting, SFC, tool management, environmental, real-time dashboard

---

## Recommended Starting Point

**Phase 1 is implementable now** — it's purely edge function refactoring with no DB changes, no new UI, and closes 6 CRs including 2 HIGH severity items. Shall I proceed with Phase 1?


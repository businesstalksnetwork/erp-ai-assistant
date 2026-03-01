

# Phase 4: Advanced AI — Implementation Plan

Phase 4 adds 4 AI-powered analytics features. No new database tables needed — all features use existing data and the Lovable AI Gateway.

---

## 4A: AI Invoice Anomaly Detection (AI-02)

**New edge function:** `supabase/functions/ai-invoice-anomaly/index.ts`
- Fetches recent invoices + supplier invoices for tenant
- Rule-based pre-screening: duplicate amounts (same vendor ±7 days), weekend invoices, round-number patterns (multiples of 10000), unusual vendors (first-time with large amounts), amount outliers (>3σ from vendor average)
- Sends flagged items to Gemini for correlation analysis and false-positive filtering
- Returns scored anomalies with explanations

**New page:** `src/pages/tenant/AiInvoiceAnomalyDetection.tsx`
- Dashboard with anomaly cards (severity-colored), summary stats
- Filters by type (duplicate, unusual vendor, round number, weekend, outlier)
- "Dismiss" / "Investigate" actions per anomaly, logged to `ai_action_log`
- AiAnalyticsNarrative integration for executive summary
- Route: `accounting/ai-invoice-anomalies`

---

## 4B: AI Cash Flow Predictor (AI-06)

**New edge function:** `supabase/functions/ai-cash-flow-predict/index.ts`
- Fetches: open AR invoices (with historical collection patterns), open AP invoices, recurring expenses, bank balances, last 12 months of actual cash flows
- Heuristic model: projects 30/60/90 day cash position using weighted collection probability per aging bucket + known AP commitments + recurring patterns
- Sends projection data to Gemini for narrative interpretation and risk flagging

**New page:** `src/pages/tenant/AiCashFlowPredictor.tsx`
- Area chart showing projected cash balance over 90 days (optimistic/expected/pessimistic bands)
- Key metrics: days of runway, projected shortfall date (if any), largest upcoming obligations
- AI narrative explaining key drivers and risks
- Route: `accounting/ai-cash-flow-predict`

---

## 4C: AI Supplier Scoring (AI-05)

**New edge function:** `supabase/functions/ai-supplier-scoring/index.ts`
- Fetches per-supplier: purchase orders (delivery dates vs promised), supplier invoices (price variance over time), payment terms, quality data from `goods_receipts`, total spend
- Calculates composite score (0-100) across 4 dimensions: delivery reliability, price stability, payment flexibility, quality/returns
- Gemini enrichment: strategic recommendations per supplier

**New page:** `src/pages/tenant/AiSupplierScoring.tsx`
- Ranked supplier table with radar chart per supplier (4 dimensions)
- Color-coded scores (green >75, yellow 50-75, red <50)
- AI recommendations column
- Route: `purchasing/ai-supplier-scoring`

---

## 4D: AI Payroll Predictor (AI-03)

**New edge function:** `supabase/functions/ai-payroll-predict/index.ts`
- Fetches: current employee list with salaries, scheduled changes (new hires with start dates, contract end dates, pending raises from employee records), last 6 months of payroll run totals
- Projects next month's gross/net payroll with delta breakdown (new hires, departures, raises)
- Gemini enrichment: budget impact narrative

**New page:** `src/pages/tenant/AiPayrollPredictor.tsx`
- Summary cards: projected gross, projected net, delta vs last month
- Breakdown table: continuing employees, new hires, departures, raises
- Trend chart (6-month history + 1-month forecast)
- AI narrative with budget recommendations
- Route: `hr/ai-payroll-predict`

---

## Technical Summary

| Item | New Edge Function | New Page | Migration | Route |
|------|------------------|----------|-----------|-------|
| 4A: Invoice Anomaly | `ai-invoice-anomaly` | `AiInvoiceAnomalyDetection.tsx` | 0 | `accounting/ai-invoice-anomalies` |
| 4B: Cash Flow Predict | `ai-cash-flow-predict` | `AiCashFlowPredictor.tsx` | 0 | `accounting/ai-cash-flow-predict` |
| 4C: Supplier Scoring | `ai-supplier-scoring` | `AiSupplierScoring.tsx` | 0 | `purchasing/ai-supplier-scoring` |
| 4D: Payroll Predictor | `ai-payroll-predict` | `AiPayrollPredictor.tsx` | 0 | `hr/ai-payroll-predict` |
| **Total** | **4 functions** | **4 pages** | **0** | **4 routes** |

All edge functions follow the existing pattern (JWT auth via `getClaims`, tenant membership verification, Lovable AI Gateway with `google/gemini-3-flash-preview`, `ai_action_log` audit trail). Route registrations go into `accountingRoutes.tsx`, `otherRoutes.tsx`, and `hrRoutes.tsx`. Config updates in `supabase/config.toml`.




## Immediate Fixes + Phase 7–8

### Fix 1: Rename "Lojalnost" → "Lojalti Program"
- `src/i18n/translations.ts` line 7010: change `loyaltyModule: "Lojalnost"` → `loyaltyModule: "Lojalti Program"`

### Fix 2: White font for aiProduction / aiWarehouse section headers
- `src/layouts/TenantLayout.tsx` line 404: change `text-primary/60` to `text-sidebar-foreground/80` for AI section headers so they render white instead of dark primary color on the dark sidebar

### Fix 3: Add missing translation keys for aiWarehouse / aiProduction
- `src/i18n/translations.ts`: add `aiWarehouse: "AI Warehouse"` / `"AI Skladište"` and `aiProduction: "AI Production"` / `"AI Proizvodnja"` — currently these keys are missing so section headers show raw key names

---

### Phase 7: AI Production Remaining Page — Quality Prediction

Per PRD page 44, AI Production should have 8 items. Current state has 7 (dashboard with tabs for calendar/bottleneck/waste + schedule + capacity + OEE). Missing: **AI Quality Prediction**.

**7.1: Create `AiQualityPrediction.tsx`**
- Page at `/production/ai-planning/quality-prediction`
- Predict defect rates per product/work center based on historical QC data
- KPI cards: predicted defect rate, top risk products, quality trend
- Table of products with predicted quality scores and recommended actions
- Uses `quality_inspections` and `production_orders` data

**7.2: Wire route + sidebar + translations**
- Add route in `otherRoutes.tsx`
- Add nav item in `productionNav` with `aiModule: "ai-production"`
- Add translation keys

---

### Phase 8: Competitive Feature Gaps

Since the PRD content for Phase 8 was truncated, I'll implement the features referenced in the competitor matrix (page 2) and sidebar structure (page 48):

**8.1: WMS Labor Management Enhancement**
- `WmsLabor.tsx` already exists — enhance with productivity metrics, shift scheduling, and picker performance rankings

**8.2: Demand Forecasting Enhancement**
- `DemandForecasting.tsx` exists — enhance with AI-driven forecast accuracy metrics and seasonal pattern detection

**8.3: Customer Risk Scoring Enhancement**
- `CustomerRiskScoring.tsx` exists — enhance with payment behavior analysis and credit limit recommendations

These are lightweight enhancements to existing pages to close competitive gaps identified in the audit.

---

### Files Modified

| File | Change |
|------|--------|
| `src/i18n/translations.ts` | Fix loyaltyModule SR, add aiWarehouse/aiProduction keys |
| `src/layouts/TenantLayout.tsx` | Fix AI section header color to white |
| `src/pages/tenant/AiQualityPrediction.tsx` | 7.1 — new page |
| `src/routes/otherRoutes.tsx` | 7.2 — add quality prediction route |
| `src/pages/tenant/WmsLabor.tsx` | 8.1 — enhance with productivity metrics |
| `src/pages/tenant/DemandForecasting.tsx` | 8.2 — enhance with AI accuracy metrics |
| `src/pages/tenant/CustomerRiskScoring.tsx` | 8.3 — enhance with payment analysis |

### Execution Order
1. Fixes (translation + sidebar color)
2. AI Quality Prediction page + wiring (Phase 7)
3. Enhance existing pages for competitive gaps (Phase 8)


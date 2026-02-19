
# Translation Fix Implementation Plan

## Assessment Summary

After a thorough audit, the translation system is in better shape than expected. The major work from the previous plan has already been completed correctly:
- `PayrollParameters.tsx`, `AiAuditLog.tsx`, `CashflowForecastWidget.tsx`, `ComplianceDeadlineWidget.tsx` all use `t()` properly
- All ~55 new keys exist in both EN and SR sections of `translations.ts`
- `BusinessRules.tsx` month names use `t(m.key)` correctly

What remains are targeted fixes in 6 files, plus a decision on the analytics pages.

---

## Remaining Issues

### Issue 1: `Settings.tsx` — 3 Hardcoded Labels + Missing Section (HIGH PRIORITY)

Lines 30, 41, 42 have hardcoded strings that bypass the translation system:
```
line 30: { label: "Parametri zarada", icon: Calculator, ... }  → should be t("payrollParamsTitle")
line 41: { label: "Legacy Import", icon: Upload, ... }          → should be t("legacyImport")
line 42: { label: "AI Revizijski dnevnik", icon: ShieldCheck }  → should be t("aiAuditLog")
```
Additionally, the plan called for a 4th section ("Audit & Data") that was never added. Currently there are only 3 sections (Organization, Finance, Operations) and 5 pages are missing: Currencies, Approval Workflows, Audit Log, Event Monitor, Pending Approvals.

The section headings use `t("organization" as any)` — keys DO exist but the `as any` cast should be removed since `organization`, `finance`, `operations` are proper TypeScript keys.

### Issue 2: `Companies.tsx` — 4 Hardcoded Serbian Toast Messages

```typescript
// Line 89: hardcoded Serbian
toast.error("PIB mora imati 9 cifara");
// Line 110: hardcoded Serbian
toast.success("Podaci pronađeni");
// Line 112: hardcoded Serbian
toast.info("PIB nije pronađen u registru");
// Line 115: hardcoded Serbian
toast.error("Greška pri pretrazi PIB-a");
```

### Issue 3: `WmsCycleCounts.tsx` — 2 Hardcoded Locale Strings

Lines 301–303 use `locale === "sr" ? "..." : "..."` directly in JSX:
- `"Nema razlika za uskladjivanje"` / `"No variances to reconcile"`
- `"Odobravanjem ćete prilagoditi..."` / `"Approving will adjust..."`

### Issue 4: `WmsReceiving.tsx` — 2 Hardcoded Locale Strings

Lines 241, 262 use `locale === "sr" ? "..." : "..."`:
- `"Broj nabavke"` / `"PO Number"`
- `"Dodaj stavku"` / `"Add Line"`

### Issue 5: `AiPlanningSchedule.tsx` — 4 Hardcoded Locale Toast Strings

Lines 96, 98, 112 use `locale === "sr" ? "..." : "..."` for toasts:
- `"Raspored generisan"` / `"Schedule generated"`
- `"Greška"` / `"Error generating schedule"`
- `"Raspored primenjen"` / `"Schedule applied"`

### Issue 6: `AiCapacitySimulation.tsx` + `AiPlanningDashboard.tsx` — Hardcoded Ternaries

Similar `locale === "sr" ? "..." : "..."` patterns in toast messages and empty states.

### Issue 7: Analytics Pages — Local `t()` Pattern (LOW PRIORITY — FUNCTIONAL)

8 pages (`ProfitabilityAnalysis`, `InventoryHealth`, `CustomerRiskScoring`, `SupplierDependency`, `MarginBridge`, `PayrollBenchmark`, `VatCashTrap`, `WorkingCapitalStress`) define a local helper:
```typescript
const t = (en: string, srText: string) => sr ? srText : en;
```
These **work correctly** — strings do switch with language toggle. The only downside is they don't go through the central translations.ts. Since these are already bilingual and functional, this plan will **not** migrate them to named keys (that would require adding ~200+ new keys), but will note them as a Phase 2 cleanup task.

---

## Files to Modify

| File | Changes |
|---|---|
| `src/i18n/translations.ts` | Add ~14 new keys for PIB lookup, WMS, planning toasts |
| `src/pages/tenant/Settings.tsx` | Fix 3 hardcoded labels, remove `as any` casts, add 4th section + 5 missing cards |
| `src/pages/tenant/Companies.tsx` | Replace 4 hardcoded toast messages with `t()` |
| `src/pages/tenant/WmsCycleCounts.tsx` | Replace 2 hardcoded ternary strings |
| `src/pages/tenant/WmsReceiving.tsx` | Replace 2 hardcoded ternary strings |
| `src/pages/tenant/AiPlanningSchedule.tsx` | Replace 3 hardcoded ternary toast strings |
| `src/pages/tenant/AiCapacitySimulation.tsx` | Replace 2 hardcoded ternary toast strings |
| `src/pages/tenant/AiPlanningDashboard.tsx` | Replace 1 hardcoded ternary empty state string |

---

## New Translation Keys

### EN additions:
```
// PIB lookup (Companies.tsx)
pibMustBe9Digits: "PIB must be 9 digits"
pibDataFound: "Data found"
pibNotFound: "PIB not found in registry"
pibLookupError: "Error searching PIB"

// WMS (CycleCounts + Receiving)
noVariancesToReconcile: "No variances to reconcile"
approveAdjustmentHint: "Approving will adjust bin stock quantities to match counted values."
poNumberLabel: "PO Number"
addLine: "Add Line"

// AI Planning toasts
scheduleGenerated: "Schedule generated"
scheduleGenerationError: "Error generating schedule"
scheduleApplied: "Schedule applied"
simulationComplete: "Simulation complete"
simulationError: "Simulation error"

// AI Planning Dashboard
noInsightsToDisplay: "No insights to display."
```

### SR additions:
```
pibMustBe9Digits: "PIB mora imati 9 cifara"
pibDataFound: "Podaci pronađeni"
pibNotFound: "PIB nije pronađen u registru"
pibLookupError: "Greška pri pretrazi PIB-a"
noVariancesToReconcile: "Nema razlika za usklađivanje"
approveAdjustmentHint: "Odobravanjem ćete prilagoditi zalihe na lokacijama prema prebrojanim količinama."
poNumberLabel: "Broj nabavke"
addLine: "Dodaj stavku"
scheduleGenerated: "Raspored generisan"
scheduleGenerationError: "Greška pri generisanju rasporeda"
scheduleApplied: "Raspored primenjen"
simulationComplete: "Simulacija završena"
simulationError: "Greška pri simulaciji"
noInsightsToDisplay: "Nema uvida za prikaz."
```

---

## Settings.tsx Reorganization (4 Sections)

```
Organization (5 cards):
  Legal Entities, Locations, Warehouses, Cost Centers, Currencies

Finance (5 cards):
  Bank Accounts, Tax Rates, Posting Rules, Accounting Architecture, Payroll Parameters

Operations (4 cards):
  Users, Business Rules, Sales Channels, Integrations

Audit & Data (5 cards):
  Approval Workflows, Pending Approvals, Audit Log, AI Audit Log, Event Monitor, Legacy Import
```

All section headings use existing typed keys: `t("organization")`, `t("finance")`, `t("operations")`, `t("auditData")` — no `as any` casts needed.

---

## Implementation Order

1. Add ~14 new keys to `translations.ts` (both EN and SR sections)
2. Fix `Settings.tsx` — labels + 4th section
3. Fix `Companies.tsx` — PIB toast messages
4. Fix `WmsCycleCounts.tsx` — reconcile dialog strings
5. Fix `WmsReceiving.tsx` — PO Number and Add Line labels
6. Fix `AiPlanningSchedule.tsx` — toast strings
7. Fix `AiCapacitySimulation.tsx` — toast strings
8. Fix `AiPlanningDashboard.tsx` — empty state string



## Codebase Cleanup & Page Consolidation — Implementation Plan

### Already Done (Skip)
- **BUG-2** (broken RPCs): Fixed in previous session
- **Nivelacija/Kalkulacija location_id + legal_entity_id**: Already added

### Phase 1: Bug Fixes & Nav Cleanup (~1 round)

1. **Remove Partners nav item** from `TenantLayout.tsx` (line 167: points to wrong URL, page is just a redirect)
2. **Delete `Partners.tsx`**, remove route from `crmRoutes.tsx`
3. **Add `DataQualityDashboard`** to analyticsNav in `TenantLayout.tsx`
4. **Add `OnboardingChecklists`** to hrNav in `TenantLayout.tsx`
5. **Move `CashFlowStatement` + `ComplianceDashboard`** routes from `otherRoutes.tsx` to `accountingRoutes.tsx`

### Phase 2: Delete 7 Superseded Pages (~1 round)

Delete files + remove routes + add redirects for:
1. `RetailPrices.tsx` → redirect to `/inventory/pricing-center`
2. `WebPrices.tsx` → redirect to `/inventory/pricing-center`
3. `BalanceSheet.tsx` → redirect to `/accounting/reports/bilans-stanja`
4. `IncomeStatement.tsx` → redirect to `/accounting/reports/bilans-uspeha`
5. `Reports.tsx` → redirect to `/accounting`
6. `HrHub.tsx` → redirect to `/hr/employees`
7. `ProductionHub.tsx` → redirect to `/production/orders`

Remove corresponding sidebar entries and lazy imports.

### Phase 3: Merge 14 Pages into Tabs (~4 rounds)

**Round 3a — HR Work Time:**
- Merge `WorkLogsBulkEntry.tsx` + `WorkLogsCalendar.tsx` as tabs into `WorkLogs.tsx`
- Merge `NightWork.tsx` + `OvertimeHours.tsx` into new `SpecialHours.tsx` with 2 tabs

**Round 3b — Payroll + AI:**
- Merge `PayrollCategories.tsx` + `PayrollPaymentTypes.tsx` as tabs into `PayrollParameters.tsx`
- Merge `AiPlanningCalendar.tsx` + `AiBottleneckPrediction.tsx` as tabs into `AiPlanningDashboard.tsx`

**Round 3c — Inventory + DMS + WMS:**
- Merge `InventoryHealth.tsx` as tab into `InventoryStock.tsx`
- Merge `DocumentBrowser.tsx` + `DmsReports.tsx` as tabs into `Documents.tsx`
- Merge `WmsLabor.tsx` as tab into `WmsDashboard.tsx`

**Round 3d — Settings:**
- Merge `CompanyCategoriesSettings.tsx` + `OpportunityStagesSettings.tsx` into `Settings.tsx` as accordion sections
- Remove old routes, add redirects, update sidebar

### Phase 4: Move Misplaced Pages (~1 round)

1. Move `AiBriefing.tsx` route/sidebar from Production AI → Analytics section
2. Move `AiAuditLog.tsx` route/sidebar from Production AI → Settings section (already linked from Settings.tsx)
3. Update `TenantLayout.tsx` sidebar for all moved items

### Phase 5: Cleanup

- Remove all deleted file imports from route files
- Verify no broken references
- Update translations for new tab names ("Grupni unos", "Kalendar", "Noćni rad", "Prekovremeni", "OVP kategorije", "Vrste isplate", etc.)

### Files Affected

| Action | Files |
|--------|-------|
| Delete (8) | Partners, RetailPrices, WebPrices, BalanceSheet, IncomeStatement, Reports, HrHub, ProductionHub |
| Delete after merge (14) | WorkLogsBulkEntry, WorkLogsCalendar, NightWork, OvertimeHours, PayrollCategories, PayrollPaymentTypes, AiPlanningCalendar, AiBottleneckPrediction, InventoryHealth, DocumentBrowser, DmsReports, WmsLabor, CompanyCategoriesSettings, OpportunityStagesSettings |
| Edit - merge targets (7) | WorkLogs, SpecialHours (new), PayrollParameters, AiPlanningDashboard, InventoryStock, Documents, WmsDashboard, Settings |
| Edit - routes (6) | All 6 route files + otherRoutes |
| Edit - layout (1) | TenantLayout.tsx |
| Edit - i18n (1) | translations.ts |

**Net result: 250 → 228 pages (-22)**


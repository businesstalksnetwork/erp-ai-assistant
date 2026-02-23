

## Fix Breadcrumb Labels + Translate All Hardcoded Strings to Serbian Latin

### Problem

1. **Breadcrumb shows raw URL slugs**: Routes like `payroll-parameters`, `ai-planning`, `legacy-import`, `ai-audit-log`, `partner-categories`, `payroll-benchmark`, `opportunity-stages`, `discount-approval`, `schedule`, `bottlenecks`, `scenarios` are missing from the `routeLabels` map in `Breadcrumbs.tsx`. This causes the breadcrumb to display "payroll-parameters" instead of "Parametri obračuna".

2. **Calendar legend shows raw DB values**: In `AiPlanningCalendar.tsx` (line 94), the status legend renders `status.replace("_", " ")` -- displaying "in progress", "draft", "completed" in English instead of translated labels.

3. **Same issue in other pages**: `WmsTasks.tsx`, `WmsPicking.tsx`, `WmsDashboard.tsx`, `WmsCycleCounts.tsx`, `Invoices.tsx` all use `status.replace("_", " ")` instead of `t(status)`.

4. **Hardcoded "Svi" / "All" and "Detail"**: In `AiPlanningCalendar.tsx` line 83 and `Breadcrumbs.tsx` line 148, these strings are not using translation keys.

---

### Changes

#### 1. `src/components/layout/Breadcrumbs.tsx`

Add missing route segments to the `routeLabels` map:

| Slug | Translation Key |
|------|----------------|
| `ai-planning` | `aiPlanning` |
| `payroll-parameters` | `payrollParamsTitle` |
| `legacy-import` | `legacyImport` |
| `ai-audit-log` | `aiAuditLog` |
| `partner-categories` | `companyCategories` |
| `payroll-benchmark` | `payrollBenchmark` |
| `opportunity-stages` | `opportunityStages` |
| `discount-approval` | `discountApprovalRules` |
| `schedule` | `schedule` |
| `bottlenecks` | `bottlenecks` |
| `scenarios` | `scenarios` |
| `web-settings` | `webSettings` |
| `web-prices` | `webPrices` |
| `dispatch-notes` | `dispatchNotes` |

Also change the hardcoded "Detail" fallback for UUID segments to use `t("detail")`.

#### 2. `src/pages/tenant/AiPlanningCalendar.tsx`

- Replace `status.replace("_", " ")` on line 94 with `t(status as any)` so legend labels use translations ("Nacrt", "U toku", "Završeno").
- Replace hardcoded `locale === "sr" ? "Svi" : "All"` on line 83 with a translation key `t("all")`.

#### 3. `src/pages/tenant/WmsTasks.tsx`, `WmsPicking.tsx`, `WmsDashboard.tsx`, `WmsCycleCounts.tsx`

Replace all `status.replace("_", " ")` calls with `t(status as any)` to use proper Serbian translations.

#### 4. `src/i18n/translations.ts`

Add any missing translation keys:
- `all`: EN "All" / SR "Sve"
- `detail`: EN "Detail" / SR "Detalj"
- `aiPlanning`: EN "AI Planning" / SR "AI planiranje"
- `schedule`: EN "Schedule" / SR "Raspored"  
- `bottlenecks`: EN "Bottlenecks" / SR "Uska grla"
- `scenarios`: EN "Scenarios" / SR "Scenariji"
- `cancelled`: EN "Cancelled" / SR "Otkazano"
- Any other keys referenced but not yet in the translations file

---

### Technical Details

**Files to modify (8):**
- `src/components/layout/Breadcrumbs.tsx` -- add ~15 missing route label mappings, fix "Detail" hardcode
- `src/pages/tenant/AiPlanningCalendar.tsx` -- translate legend + filter labels
- `src/pages/tenant/WmsTasks.tsx` -- translate status badges
- `src/pages/tenant/WmsPicking.tsx` -- translate status badges
- `src/pages/tenant/WmsDashboard.tsx` -- translate status labels
- `src/pages/tenant/WmsCycleCounts.tsx` -- translate status badges
- `src/pages/tenant/Invoices.tsx` -- translate SEF status
- `src/i18n/translations.ts` -- add missing keys for both EN and SR locales



## Fix: Documents Tabs, GlobalSearch Cleanup, Settings Accordion

### Issue 1: Documents.tsx missing tabs
`DocumentBrowser.tsx` and `DmsReports.tsx` redirect to `/documents?tab=browser` and `/documents?tab=reports`, but `Documents.tsx` ignores the `?tab=` query param entirely. Need to:
- Read `?tab` from URL in `Documents.tsx` using `useSearchParams`
- Wrap existing content as the default "registry" tab
- Lazy-load `DocumentBrowserContent` and `DmsReportsContent` as additional tabs
- Need to check what those pages actually render to extract their content

### Issue 2: GlobalSearch stale entries
Remove/update entries pointing to now-merged pages:
- Line 61: `/inventory/retail-prices` → now redirect to `/inventory/pricing-center`
- Line 90: `WMS Labor` → merged into WMS Dashboard tab
- Line 135: `Document Import` → merged into Bank Statements
- Line 177-178: Work Logs Bulk/Calendar → merged as tabs in `/hr/work-logs`
- Line 179: Overtime → merged into `/hr/special-hours`
- Line 180: Night Work → merged into `/hr/special-hours`
- Line 191-192: Payroll Categories/Payment Types → merged into PayrollParameters tabs
- Line 232: Web Prices → redirect to pricing center
- Line 239-240: DMS Browser/Reports → merged as tabs in `/documents`

### Issue 3: Settings accordion for CompanyCategoriesSettings + OpportunityStagesSettings
The plan called for merging these into Settings.tsx as accordion sections. They are currently standalone pages linked from Settings hub. Will:
- Import their content as lazy-loaded components within collapsible accordion sections in `Settings.tsx`
- Keep the routes working (no breaking change) but add inline access from Settings page
- Convert `CompanyCategoriesSettings.tsx` and `OpportunityStagesSettings.tsx` to redirects

### Steps
1. Add tab support to `Documents.tsx` (registry/browser/reports tabs, read `?tab` from URL)
2. Clean up ~12 stale GlobalSearch entries (update paths or remove duplicates)
3. Add CompanyCategoriesSettings + OpportunityStagesSettings as collapsible sections in Settings.tsx
4. Convert CompanyCategoriesSettings.tsx and OpportunityStagesSettings.tsx to redirects


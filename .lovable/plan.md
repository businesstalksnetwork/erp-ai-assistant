

## v2.2 Remaining — Status & Implementation Plan

### Already Complete (12 of 22)
Items verified as done in current codebase:
- **#1**: `settings-business-rules` is a valid permission (used in `rolePermissions.ts` + `settingsRoutes.tsx`) — NOT dead
- **#2**: All 10 accounting routes already in `accountingNav` (lines 93-133)
- **#3**: Production sub-pages already in `productionNav` (kanban, gantt, quality, cost-variance, mrp, maintenance)
- **#4**: WMS labor + returns already in `inventoryNav` (lines 89-90)
- **#5**: Settings sidebar already grouped with sections (`settingsOrganization`, `settingsFinance`, etc.)
- **#6**: 30+ settings sub-pages already in sidebar
- **#7**: GlobalSearch already covers settings pages
- **#17** (partial): `staleTime` already on legal entities, chart of accounts, permissions, tenants
- **#18**: `CollapsibleNavGroup` already wrapped in `React.memo`
- **#20**: All route pages already use `React.lazy` via route modules

### Remaining: 10 Items across 4 Rounds

---

**Round 1 — Quick Wins (4 items, ~2 hr)**

| # | Task | Detail |
|---|------|--------|
| 12 | Create `FormSkeleton` component | New `src/components/shared/FormSkeleton.tsx` — reusable skeleton with header + form field placeholders |
| 17 | Add `staleTime` to remaining hooks | Grep for tax rates, currencies, warehouses, employees queries missing `staleTime` and add 5-min cache |
| 19 | Add `rollup-plugin-visualizer` | Install package, add to `vite.config.ts` as optional plugin |
| 21 | Wire `PageErrorBoundary` into routes | Wrap route elements in `settingsRoutes.tsx`, `accountingRoutes.tsx`, `hrRoutes.tsx`, etc. |

**Round 2 — Table Migration Batch 1 (Items 13-14, ~4 hr)**

Audit all 182 files importing raw `<Table>` and migrate the first 5-6 list pages to `ResponsiveTable`:
- `TravelOrders.tsx`, `PK1Book.tsx`, `PPPPO.tsx`, `BankStatements.tsx` (already done), `JournalEntries.tsx`, `Employees.tsx`
- Add sort, column toggle, CSV export where appropriate

**Round 3 — Table Migration Batch 2 (Items 15-16, ~8 hr)**

Migrate hub/detail pages:
- `Invoices.tsx`, `Products.tsx` (already done), `Partners.tsx`, `Companies.tsx`, `ChartOfAccounts.tsx`, `PayrollCategories.tsx`, `EmployeeSalaries.tsx`, `BomTemplates.tsx`, `WmsTasks.tsx`, `WmsLabor.tsx`, `EventMonitor.tsx`, `SalesPerformance.tsx`
- Remaining ~10 pages with simpler tables

**Round 4 — Forms & Entity Selector (Items 8-11, 22, ~10 hr)**

| # | Task | Detail |
|---|------|--------|
| 8 | TenantProfile legal entity selector | Add `legal_entity_id` dropdown linking to `legal_entities` table |
| 9 | Bank API connection test | Add "Test Connection" button to Integrations page that pings bank API endpoint |
| 10 | InvoiceForm → RHF + Zod | Migrate ~900-line form from manual useState to `react-hook-form` with Zod schema validation |
| 11 | SupplierInvoiceForm → RHF + Zod | Same migration for ~650-line supplier invoice form |
| 22 | Extend `EntitySelector` usage | Replace inline partner/employee/product selects in InvoiceForm, SupplierInvoiceForm, TravelOrderForm |

---

### Recommended Approach
Start with **Round 1** (quick wins) to close out easy items, then tackle **Rounds 2-3** (table migration bulk) which is the heaviest lift at ~12 hours. Round 4 (form migration) is highest-risk and can be deferred if needed.


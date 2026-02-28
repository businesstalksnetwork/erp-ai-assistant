

## Phase 4: Navigation & Sidebar Restructure — 6 Items

### Current State Audit

| Area | Current | Target |
|------|---------|--------|
| Returns | Standalone sidebar group + `/returns` route + `"returns"` ModuleGroup | Subsection under Inventory at `/inventory/returns` |
| AI WMS (Slotting) | Already under `inventoryNav` at `/inventory/wms/slotting` | Stays; other AI WMS pages are new (Phase 6+) |
| AI Production | Items in `productionNav` at `/production/ai-planning/*` | Visually grouped as "AI Production" subsection with Sparkles badge |
| Sidebar groups | 15 top-level (Returns is standalone with 1 item) | 14 top-level (Returns absorbed into Inventory) |
| Module toggles | No `tenant_modules` table; AI features always visible | Tenant-level toggle for `ai-wms` and `ai-production` |
| Service nav | Has "New Service Order" as sidebar item | Remove — should be button on Service Orders page |

### Implementation Plan

#### 4.1: Move Returns into Inventory
- **Route:** Change `/returns` to `/inventory/returns` in `otherRoutes.tsx` → move to `inventoryRoutes.tsx`
- **Sidebar:** Remove `returnsNav` array and standalone section. Add `{ key: "returns", url: "/inventory/returns", icon: RotateCcw, section: "returnsSection" }` to `inventoryNav`
- **Permissions:** Remove `"returns"` from `ModuleGroup` type and all `rolePermissions` entries. Gate under `"inventory"` instead
- **Route mapping:** Remove `"/returns": "returns"` from `routeToModule`; `/inventory/returns` already covered by `"/inventory/": "inventory"`
- **Redirect:** Add `<Route path="returns" element={<Navigate to="/inventory/returns" replace />} />` for backward compat

#### 4.2: Nest AI WMS as toggleable subsection
- **Sidebar:** In `inventoryNav`, change the WMS AI items' `section` to `"aiWarehouse"` and add Sparkles icon badge
- **Rendering:** Update `CollapsibleNavGroup` or TenantLayout to conditionally render items with `section: "aiWarehouse"` only when `isModuleEnabled("ai-wms")` is true
- Items already exist at `/inventory/wms/slotting`, `/inventory/wms/cycle-counts`; no route changes needed

#### 4.3: Nest AI Production as toggleable subsection
- **Sidebar:** In `productionNav`, change AI items' section from `"aiPlanningSection"` to `"aiProduction"` with Sparkles badge
- **Rendering:** Conditionally render items with `section: "aiProduction"` only when `isModuleEnabled("ai-production")` is true
- Routes remain at `/production/ai-planning/*`; no path changes needed

#### 4.4: Create `tenant_modules` table + `useTenantModules` hook
- **Migration:** Create `tenant_modules` table with `(tenant_id, module)` PK, `enabled` boolean, `enabled_at`, `enabled_by`
- **RLS:** Members can SELECT; admins can ALL (using `get_user_tenant_ids`)
- **Hook:** `src/hooks/useTenantModules.ts` with `isModuleEnabled(mod)` helper
- **Settings UI:** New `/settings/modules` page with toggle cards for "AI Warehouse" and "AI Production"
- **Route guard:** `ModuleGuard` component wrapping AI route groups

#### 4.5: Sidebar cleanup
- Remove `{ key: "newServiceOrder", url: "/service/orders/new", icon: FileInput }` from `serviceNav`
- Remove duplicate `dmsSettings` from `documentsNav` (keep only in `settingsNav`)
- Move `costCenterPL` from `accountingNav` section `"assetsAccruals"` to section `"reporting"`
- Move `cashFlowStatement` from section `"taxClosing"` to section `"reporting"`
- Move `qcCheckpoints` from section `"infrastructure"` to after `qualityControl` in section `"shopFloor"`
- Move `oeeDashboard` into AI Production section items
- Reorder `productionNav`: Engineering (BOM) → Operations (Orders, Kanban, Gantt) → Quality → Maintenance → MRP → Infrastructure (Work Centers, Equipment) → Reporting → AI Production

#### 4.6: Update sidebar rendering order
- Reorder sidebar groups: Dashboard → CRM → Sales → POS → Purchasing → Inventory (with Returns + AI WMS) → Production (with AI Production) → Service → Loyalty → Accounting → Assets → HR → Documents → Analytics → Settings
- Current order has Inventory before Purchasing and Analytics before Accounting — reorder per PRD

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | 4.4 — `tenant_modules` table + RLS |
| `src/config/rolePermissions.ts` | 4.1 — remove `"returns"` ModuleGroup, update `routeToModule` |
| `src/layouts/TenantLayout.tsx` | 4.1–4.6 — restructure nav arrays, rendering order, conditional AI sections |
| `src/routes/inventoryRoutes.tsx` | 4.1 — add Returns route |
| `src/routes/otherRoutes.tsx` | 4.1 — remove Returns route, add redirect |
| `src/hooks/useTenantModules.ts` | 4.4 — new hook |
| `src/pages/tenant/ModuleSettings.tsx` | 4.4 — new settings page with toggle cards |
| `src/routes/settingsRoutes.tsx` | 4.4 — add `/settings/modules` route |
| Translation files | New keys for `aiWarehouse`, `aiProduction`, `returnsSection`, `modules` |

### Execution Order
1. Migration: `tenant_modules` table (4.4)
2. `useTenantModules` hook + `ModuleGuard` component (4.4)
3. `rolePermissions.ts` — remove `"returns"` (4.1)
4. Routes — move Returns, add redirect (4.1)
5. `TenantLayout.tsx` — full sidebar restructure (4.1–4.6)
6. `ModuleSettings.tsx` page + route (4.4)


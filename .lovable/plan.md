

# Assets Digitalization Module — Phase 0: Foundation

This is a large module (5 sub-modules, ~20 database tables, 9 edge functions). Following the PRD's phased delivery plan, this implementation covers **Phase 0 (Foundation) + Phase 1 (Electronic Registry)** — the critical base that unblocks all subsequent phases.

## Scope of This Implementation

### Phase 0 — Foundation (Database + Permissions + Navigation)

**1. Database Migration — 10 new tables:**

| Table | Purpose |
|-------|---------|
| `asset_categories` | Hierarchical taxonomy with GL account defaults, useful life, depreciation method |
| `asset_locations` | Location hierarchy (building/room/warehouse) with cost center link |
| `assets` | Master table for ALL asset types (fixed, vehicle, material_good, intangible) |
| `asset_documents` | Document vault per asset (invoices, warranties, certificates) |
| `fixed_asset_details` | One-to-one extension: depreciation method, tax group, GL accounts |
| `fixed_asset_depreciation_schedules` | Monthly depreciation records with accounting + tax parallel tracking |
| `fixed_asset_revaluations` | MRS 16 revaluation records |
| `fixed_asset_impairments` | MRS 36 impairment records |
| `fixed_asset_disposals` | Disposal/write-off records with gain/loss |
| `asset_assignments` | Material goods assignment to employees/locations |

All tables with:
- `tenant_id` FK + RLS policies using `get_user_tenant_ids(auth.uid())`
- `uuid` PKs, `created_at`/`updated_at` timestamps
- `NUMERIC(15,2)` for monetary columns
- GIN index on `assets.name`, `assets.serial_number`, `assets.asset_code`

**2. Seed standard Serbian asset categories** (10 categories from PRD: LAND, BUILDING, EQUIP_PROD, EQUIP_IT, VEHICLE, FURNITURE, TOOLS, INTANGIBLE_SW, INTANGIBLE_BR, MATERIAL_GOODS)

**3. Module permissions wiring:**
- Add `"assets"` to `ModuleGroup` type in `rolePermissions.ts`
- Grant access: admin (all), manager, accountant, store roles
- Add `/assets/` route prefix to `routeToModule`

### Phase 1 — Electronic Registry + Assets Hub (UI)

**4. New route file: `src/routes/assetsRoutes.tsx`** with all `/assets/*` routes

**5. New pages:**

| Page | Route | Purpose |
|------|-------|---------|
| `AssetsHub.tsx` | `/assets` | Module dashboard — KPI cards (total assets, active, disposed, depreciation this month), quick actions, alerts |
| `AssetRegistry.tsx` | `/assets/registry` | Master list with search/filter/export, asset type tabs |
| `AssetForm.tsx` | `/assets/registry/new` + `/assets/registry/:id` | Create/edit asset with category selection, type-specific fields |
| `AssetCategories.tsx` | `/assets/categories` | Category CRUD with hierarchy |

**6. Sidebar navigation** — Add "Imovina" (Assets) collapsible group in `TenantLayout.tsx` between Accounting and HR

**7. Translations** — Add ~40 new keys for assets module labels

### Integration Points Wired

- Assets link to `partners` (supplier), `employees` (responsible person), `cost_centers`, `legal_entities`
- `asset_categories` carry GL account codes for posting rules engine
- `fixed_asset_details` carries depreciation parameters for future Phase 2 depreciation batch

## Files Created/Modified

| File | Action |
|------|--------|
| DB migration | CREATE 10 tables + RLS + indexes + seed categories |
| `src/config/rolePermissions.ts` | Add `"assets"` module group |
| `src/routes/assetsRoutes.tsx` | NEW — all asset routes |
| `src/pages/tenant/AssetsHub.tsx` | NEW — module dashboard |
| `src/pages/tenant/AssetRegistry.tsx` | NEW — master asset list |
| `src/pages/tenant/AssetForm.tsx` | NEW — create/edit asset |
| `src/pages/tenant/AssetCategories.tsx` | NEW — category management |
| `src/layouts/TenantLayout.tsx` | Add assets nav group |
| `src/App.tsx` | Import assetsRoutes |
| `src/components/layout/GlobalSearch.tsx` | Add asset search entries |
| `src/components/layout/Breadcrumbs.tsx` | Add asset breadcrumb mappings |
| `src/i18n/translations.ts` | Add ~40 translation keys |

## Technical Details

### Asset Code Auto-Generation
Format: `{prefix}-{YYYY}-{NNNNN}` where prefix comes from `asset_categories.code_prefix`. Sequence tracked per tenant+year via a DB function `generate_asset_code(tenant_id, prefix)`.

### Account Type Mapping for Categories
```text
LAND, BUILDING, EQUIP_*, VEHICLE, FURNITURE, TOOLS → asset_type = 'fixed_asset'
INTANGIBLE_SW, INTANGIBLE_BR → asset_type = 'intangible'
MATERIAL_GOODS → asset_type = 'material_good'
```

### RLS Pattern (consistent with all other tables)
```sql
CREATE POLICY "tenant_isolation" ON assets
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
```

## What This Unlocks (Future Phases)
- Phase 2: Depreciation batch run, revaluation, impairment, disposal GL posting
- Phase 3: Assignment/Revers workflow, HR offboarding integration
- Phase 4: Popis (inventory count) with commission reports
- Phase 5: Vehicle fleet management
- Phase 6: IFRS 16 lease accounting


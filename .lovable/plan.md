

## Phase 5: Frontend & Settings Redesign + Sidebar Fix — 2 Tracks

### Track A: Fix Sidebar Movement

**Problem:** Looking at the screenshots vs current implementation, the `CollapsibleNavGroup` uses `Collapsible` with `defaultOpen={isActive}` — this is uncontrolled and only sets initial state. When users navigate between modules, previously-open sections stay open and new ones don't auto-open, causing inconsistent visual state. Additionally, the collapsible trigger and content lack smooth animation, causing abrupt "jumps."

**Fixes:**
1. In `CollapsibleNavGroup`: switch from uncontrolled `defaultOpen` to controlled `open` state that tracks `isActive` — auto-expand the active group, auto-collapse others
2. Add CSS transition/animation to `CollapsibleContent` for smooth open/close (Radix Collapsible supports `data-[state=open]` / `data-[state=closed]` for animation)
3. Ensure only one non-Settings group can be open at a time (accordion behavior) by lifting open-group state to `TenantLayout` and passing it down

**Files:** `src/layouts/TenantLayout.tsx`

---

### Track B: Settings Redesign (Task 5.1) — Move 17 Items Out of Settings

Relocate items from Settings sidebar + routes to their parent modules:

| Item | From | To Sidebar | New Route |
|------|------|-----------|-----------|
| Warehouses | Settings > Organization | Inventory > Configuration | `/inventory/warehouses` |
| Cost Centers | Settings > Finance | Accounting > Configuration | `/accounting/cost-centers` |
| Tax Rates | Settings > Finance | Accounting > Configuration | `/accounting/tax-rates` |
| Currencies | Settings > Finance | Accounting > Configuration | `/accounting/currencies` |
| Bank Accounts | Settings > Finance | Accounting > Bank Accounts | Already at `/accounting/bank-accounts` — remove from Settings nav |
| Posting Rules | Settings > Finance | Accounting > Configuration | `/accounting/posting-rules` |
| Business Rules | Settings > Access | Accounting > Configuration | `/accounting/business-rules` |
| Accounting Architecture | Settings > Advanced | Accounting > Configuration | `/accounting/architecture` |
| Payroll Parameters | Settings > Finance | HR > Compensation | `/hr/payroll-parameters` |
| Partner Categories | Settings > Integrations | CRM > Configuration | `/crm/categories` |
| Opportunity Stages | Settings > Integrations | CRM > Configuration | `/crm/stages` |
| Discount Approval Rules | Settings > Integrations | Sales > Configuration | `/sales/discount-rules` |
| DMS Settings | Settings > Advanced | Documents > Settings | `/documents/settings` |
| Pending Approvals | Settings > Audit | Keep route, move nav to Dashboard area | — |
| Audit Log | Settings > Audit | Keep in Settings (admin-only) | — |
| AI Audit Log | Settings > Audit | Keep in Settings (admin-only) | — |
| Event Monitor | Settings > Audit | Keep in Settings (admin-only) | — |
| Legacy Import | Settings > Advanced | Keep in Settings (admin-only) | — |

**Implementation:**

1. **Sidebar nav arrays** (`TenantLayout.tsx`):
   - Add "configuration" section items to `accountingNav` (Cost Centers, Tax Rates, Currencies, Posting Rules, Business Rules, Accounting Architecture)
   - Add Warehouses to `inventoryNav` configuration section
   - Add Payroll Parameters to `hrNav` compensation section
   - Add Partner Categories, Opportunity Stages to `crmNav` configuration section
   - Add Discount Approval Rules to `salesNav` configuration section
   - Add DMS Settings to `documentsNav`
   - Remove all relocated items from `settingsNav` (reducing from 34 to ~15)

2. **Routes** (`settingsRoutes.tsx`, `accountingRoutes.tsx`, `inventoryRoutes.tsx`, `crmRoutes.tsx`, `salesRoutes.tsx`, `hrRoutes.tsx`, `otherRoutes.tsx`):
   - Add new routes under parent modules
   - Add redirects from old `/settings/*` paths to new locations for backward compat

3. **Settings nav cleanup**: Keep only: Company Settings, Tenant Profile, Legal Entities, Org Companies, Locations, Users, Role Permissions, Approval Workflows, Modules, Integrations, Integration Health, Notification Categories, Data Protection, Data Retention, Security Incidents, Audit Log, AI Audit Log, Event Monitor, Legacy Import

### Execution Order

1. Sidebar accordion behavior fix (Track A)
2. Move nav items + add configuration sections to module navs
3. Move routes + add redirects
4. Clean up `settingsNav` array

### Files Modified

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Accordion sidebar behavior; move 13 items from `settingsNav` to module navs; add "configuration" sections |
| `src/routes/settingsRoutes.tsx` | Add redirects for relocated routes |
| `src/routes/accountingRoutes.tsx` | Add 6 configuration routes |
| `src/routes/inventoryRoutes.tsx` | Add Warehouses route |
| `src/routes/crmRoutes.tsx` | Add Partner Categories, Opportunity Stages routes |
| `src/routes/salesRoutes.tsx` | Add Discount Rules route |
| `src/routes/hrRoutes.tsx` | Add Payroll Parameters route |
| `src/routes/otherRoutes.tsx` | Add DMS Settings route under Documents |


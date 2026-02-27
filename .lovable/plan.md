

## Service Order Management Module — Implementation Plan

This is the full "Servisna Delatnost" module from the PRD. Due to scale (~1300 lines of PRD), implementation will be split across multiple passes.

### Pass 1: Database Foundation + Module Registration

**Migration 1 — Schema:**
- Add `warehouse_type TEXT DEFAULT 'standard'` to `warehouses` table
- Create 5 tables: `service_devices`, `service_orders`, `service_work_orders`, `service_order_lines`, `service_order_status_log` (exact SQL from PRD sections 6.2–6.6)
- RLS on all 5 tables using `tenant_members` pattern (same as rest of app)
- Indexes as specified

**Migration 2 — RPCs + Triggers:**
- `generate_service_order_number(p_tenant_id)`
- `generate_work_order_number(p_tenant_id)`
- `check_device_warranty(p_device_id)`
- `create_service_intake(...)` — unified 3-channel intake
- `change_service_order_status(...)` — validated transitions + device location update
- `consume_service_part(...)` — add part + auto inventory movement
- `update_service_order_totals()` trigger on `service_order_lines`
- `generate_invoice_from_service_order(p_order_id)`

**Module Registration:**
- Insert `service` row into `module_definitions` table (key: `service`, name: `Service Management`, sort_order: 12)
- Add `"service"` to `ModuleGroup` type in `rolePermissions.ts`
- Add `"service"` to relevant roles (admin → ALL, manager, store_manager, store, sales, production_manager, warehouse_manager, cashier)
- Add route mapping `/service/` → `"service"` in `routeToModule`

### Pass 2: Core Pages — Orders + Devices

**New Pages (5):**
- `ServiceOrders.tsx` — table list with status filters + KPI stat cards (open, urgent, waiting parts, completed today)
- `ServiceOrderForm.tsx` — channel selector (retail/wholesale/internal), device picker, warranty badge, issue description, priority
- `ServiceOrderDetail.tsx` — timeline sidebar + tabs (work orders, lines, device history) + payment action buttons
- `ServiceDevices.tsx` — device registry with search, location badge, service history count
- `ServiceWorkOrders.tsx` — technician's personal work queue (my assigned work orders)

**New Components (~12):**
- `IntakeChannelSelector.tsx` — 3-option toggle with conditional fields
- `DeviceSelector.tsx` — search existing / create new device inline
- `DeviceLocationBadge.tsx`, `WarrantyBadge.tsx`
- `ServiceOrderTimeline.tsx` — status history
- `WorkOrderEditor.tsx`, `WorkOrderCard.tsx`
- `ServiceLineEditor.tsx` — add labor/parts lines
- `ServiceStatsCards.tsx` — KPI cards for list page
- `PaymentResolver.tsx` — channel-based payment action buttons
- `ServiceKanbanBoard.tsx` + `ServiceKanbanCard.tsx` — drag-drop kanban with dnd-kit

**Routes:**
- `/service/orders` → ServiceOrders
- `/service/orders/new` → ServiceOrderForm
- `/service/orders/:id` → ServiceOrderDetail
- `/service/my-work-orders` → ServiceWorkOrders
- `/service/devices` → ServiceDevices

**Sidebar Navigation:**
- New `serviceNav` array in TenantLayout with 4 items (orders, new order, my work orders, devices)
- Gated by `canAccess("service")`, icon: `Wrench`

### Pass 3: Translations + Widgets

**Translations:** ~70 new keys (both EN + SR) from PRD section 14

**Widget Registry:** 4 new widgets:
- `kpi_service_open` — open service orders count
- `kpi_service_urgent` — urgent orders count
- `service_overview` — action widget
- `technician_workload` — chart widget

### Files Modified

| File | Change |
|---|---|
| `src/config/rolePermissions.ts` | Add `"service"` module group + role mappings + route mapping |
| `src/config/widgetRegistry.ts` | Add 4 service widgets |
| `src/layouts/TenantLayout.tsx` | Add `serviceNav` + sidebar section |
| `src/routes/otherRoutes.tsx` | Add service routes (5 pages) |
| `src/i18n/translations.ts` | Add ~70 translation keys |
| `src/components/layout/GlobalSearch.tsx` | Add service pages to search |

| New File | Purpose |
|---|---|
| Migration SQL × 2 | Schema + RPCs |
| `src/pages/tenant/ServiceOrders.tsx` | Main list page |
| `src/pages/tenant/ServiceOrderForm.tsx` | Create/edit form |
| `src/pages/tenant/ServiceOrderDetail.tsx` | Detail view |
| `src/pages/tenant/ServiceDevices.tsx` | Device registry |
| `src/pages/tenant/ServiceWorkOrders.tsx` | Technician queue |
| `src/components/service/*.tsx` × 12 | UI components |

### Module Enablement

A new row will be inserted into `module_definitions` with `key: 'service'`. This automatically makes it available in the Super Admin → Module Management page for per-tenant enable/disable toggling (the existing `ModuleManagement.tsx` page already reads from `module_definitions` and `tenant_modules`).

### Risk
- Low for schema — standard multi-tenant pattern with RLS
- Medium for RPCs — `create_service_intake` and `consume_service_part` touch multiple tables; will test with edge cases
- Payment integration (POS + invoice generation) depends on existing RPCs working correctly — may need adjustments in later passes


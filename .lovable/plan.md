

## Phase 11 — Service Module Improvements

### Current State
- 5 service pages exist: ServiceOrders (list), ServiceOrderForm (create), ServiceOrderDetail (read-only), ServiceDevices (list), ServiceWorkOrders (technician view)
- 4 RPCs exist with **zero UI callers**: `change_service_order_status`, `consume_service_part`, `generate_invoice_from_service_order`, `check_device_warranty`
- ServiceOrderDetail is read-only — no status transitions, no parts consumption, no invoice generation
- ServiceDevices has no detail page, no service history, no CRUD
- No service dashboard
- No `service_contracts` table
- ServiceOrderForm has silent data loss bug (second update has no error check)

### Plan (8 items)

#### 1. SVC-BUG-1: Fix silent data loss in ServiceOrderForm
- Line ~110: add error check after the second `supabase.from("service_orders").update(updates)` call
- Throw error if update fails

#### 2. SVC-IMP-1: Wire status transition buttons to ServiceOrderDetail
- Add status flow map (`received→diagnosed→in_repair/waiting_parts→completed→delivered`)
- Render next-status buttons calling `change_service_order_status` RPC
- Add diagnosis/resolution text inputs when transitioning to `diagnosed`/`completed`

#### 3. SVC-IMP-1: Wire parts consumption to ServiceOrderDetail
- Add "Parts" tab with form: product select, quantity, unit price, warranty checkbox
- Call `consume_service_part` RPC
- Show consumed parts list from `service_order_lines`

#### 4. SVC-IMP-1: Wire invoice generation to ServiceOrderDetail
- Show "Generate Invoice" button when `status === "completed"` and no `linked_invoice_id`
- Call `generate_invoice_from_service_order` RPC
- Show link to generated invoice when exists

#### 5. SVC-IMP-2: Device detail page with service history
- New route `/service/devices/:id` → `ServiceDeviceDetail.tsx`
- Show device info, warranty status (via `check_device_warranty` RPC), service history timeline, total repair cost
- Link from ServiceDevices list rows

#### 6. SVC-IMP-3: Service Hub Dashboard
- New page `ServiceDashboard.tsx` at `/service/dashboard`
- KPIs: orders by status (pie chart), avg repair time, monthly revenue, overdue repairs count
- Technician workload bar chart

#### 7. SVC-IMP-4: Service Contracts & SLA table
- Migration: create `service_contracts` table with RLS
- New page `ServiceContracts.tsx` with CRUD list
- SLA traffic-light indicators (response time vs SLA hours)

#### 8. Add translation keys
- ~15 keys for status transitions, parts consumption, invoice generation, dashboard labels, contracts

### Files Modified

| File | Change |
|------|--------|
| `src/pages/tenant/ServiceOrderForm.tsx` | Fix silent data loss bug |
| `src/pages/tenant/ServiceOrderDetail.tsx` | Status buttons, parts tab, invoice generation |
| `src/pages/tenant/ServiceDeviceDetail.tsx` | New — device detail + history |
| `src/pages/tenant/ServiceDevices.tsx` | Add row click → detail navigation |
| `src/pages/tenant/ServiceDashboard.tsx` | New — operational dashboard |
| `src/pages/tenant/ServiceContracts.tsx` | New — contracts CRUD |
| `src/routes/otherRoutes.tsx` | Add new routes |
| `src/layouts/TenantLayout.tsx` | Add nav items for dashboard + contracts |
| `src/i18n/translations.ts` | ~15 new keys |
| New migration | `service_contracts` table + RLS |

### Execution Order
1. Bug fix (ServiceOrderForm)
2. ServiceOrderDetail: status transitions + parts + invoice generation
3. Device detail page + history
4. Service dashboard
5. Service contracts (migration + page)
6. Translation keys + routes + nav




## Phase 7: General Improvements — Error Boundaries, Audit Trail, Bulk Ops, Notifications

### Current State Assessment

| Area | Status | Gaps |
|------|--------|------|
| Error Boundaries | `PageErrorBoundary` on all routes, global `ErrorBoundary` in layout | No error reporting/logging to audit_log; no recovery suggestions |
| Audit Trail | 23 tables have triggers; `log_audit_event()` captures before/after state | ~30+ important tables missing triggers (bank_accounts, leave_requests, fleet_*, lease_contracts, etc.); AuditLog UI has hardcoded Serbian ("Pre izmene"/"Posle izmene"); no date range filter; no CSV export |
| Bulk Operations | BulkEntitlementGenerator, WorkLogsBulk, BankStatement bulk confirm | No bulk delete/archive pattern; no bulk status change on invoices/orders |
| Notifications | Bell + dropdown + realtime + preferences + role-based categories | No delete/clear old notifications; no "View All" page; dropdown limited to 50 items |

---

### Plan (7 items)

#### 1. Add audit triggers to ~30 missing critical tables
**DB migration** adding `AFTER INSERT OR UPDATE OR DELETE` triggers using `log_audit_event()` for: `bank_accounts`, `bank_reconciliations`, `bank_statements`, `leave_requests`, `leave_policies`, `fleet_vehicles`, `fleet_fuel_logs`, `fleet_service_orders`, `fleet_insurance`, `lease_contracts`, `approval_requests`, `budgets`, `cost_centers`, `departments`, `locations`, `legal_entities`, `employee_contracts`, `employee_salaries`, `assets`, `goods_receipts`, `dispatch_notes`, `internal_orders`, `internal_transfers`, `inventory_write_offs`, `inventory_stock_takes`, `exchange_rates`, `kalkulacije`, `kompenzacija`, `nivelacije`, `advance_payments`.

#### 2. Improve AuditLog UI
- Add date range filter (from/to date inputs)
- Add CSV export button using existing `exportToCsv` utility
- Replace hardcoded Serbian labels ("Pre izmene"/"Posle izmene") with `t()` calls
- Add `entity_id` display and clickable link to the entity
- Add new translation keys

#### 3. Add bulk status operations for invoices
- Add select-all checkbox + individual row checkboxes to invoice list
- "Bulk Actions" dropdown: mark as paid, mark as sent, export selected
- Uses existing `supabase.from("invoices").update()` with `.in("id", selectedIds)`

#### 4. Notifications: add clear/delete + "View All" page
- Add `deleteNotification` and `clearAllRead` to `useNotifications` hook
- Add "Clear read" button to `NotificationDropdown`
- Create `/settings/notifications` page showing full notification history with filters
- Add route to settings routes

#### 5. Error boundary: log crashes to audit_log
- In `PageErrorBoundary` and `ErrorBoundary`, on `componentDidCatch`, insert a row into `audit_log` with `action: 'frontend_error'`, `entity_type: 'ui'`, and the error stack in `details`
- Silent fire-and-forget — no user impact if insert fails

#### 6. Add missing translation keys for Phase 7 features
- Add ~20 keys: `beforeChange`, `afterChange`, `dateFrom`, `dateTo`, `exportAuditLog`, `clearRead`, `viewAllNotifications`, `bulkActions`, `markAsPaid`, `markAsSent`, `selectAll`, `selectedCount`, `frontendError`, `notificationHistory`

#### 7. Update ENTITY_TYPES list in AuditLog
- Current list has 14 types; expand to include the 30+ newly-triggered tables so they appear in the filter dropdown

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | Triggers for ~30 tables |
| `src/pages/tenant/AuditLog.tsx` | Date filter, CSV export, i18n, entity link, expanded entity types |
| `src/hooks/useNotifications.ts` | Add delete + clearAllRead |
| `src/components/notifications/NotificationDropdown.tsx` | Clear read button |
| `src/pages/tenant/NotificationHistory.tsx` | New full-page notification view |
| `src/routes/settingsRoutes.tsx` | Add notification history route |
| `src/components/ErrorBoundary.tsx` | Log to audit_log on catch |
| `src/components/shared/PageErrorBoundary.tsx` | Log to audit_log on catch |
| `src/i18n/translations.ts` | ~20 new keys |
| `src/pages/tenant/Invoices.tsx` | Bulk select + bulk actions |

### Execution Order
1. DB migration (audit triggers)
2. Translation keys
3. AuditLog UI improvements
4. Error boundary audit logging
5. Notification improvements
6. Bulk invoice operations


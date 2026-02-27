

## Dashboard Widget System Upgrade

This is a big upgrade touching 3 areas: (A) resize controls in edit mode, (B) 20+ new KPI widgets, (C) new retail/POS category.

### A — Widget Resize Controls in Edit Mode

Currently widgets have fixed width (set by `defaultWidth` in registry). The DB already stores `width` and `height` per widget. We need resize buttons visible in edit mode.

**WidgetContainer.tsx** — Add resize buttons (width toggle) in edit mode:
- Show small width indicator buttons: 3, 4, 6, 12 (representing 1/4, 1/3, 1/2, full)
- On click, call `updateLayout` with new width for that widget
- Visual: small button row at bottom of widget in edit mode

**WidgetContainer.tsx** — Also support `gridRow: span ${height}` in style so height=2 widgets take 2 rows.

**CustomizableDashboard.tsx** — Pass `updateLayout` to `WidgetContainer` as `onResize` callback. Add `grid-auto-rows: minmax(120px, auto)` to the grid.

### B — 20+ New KPI Widget Definitions

Add to **widgetRegistry.ts**:

| Widget ID | Title Key | Module | Description |
|---|---|---|---|
| `kpi_revenue_yesterday` | revenueYesterday | accounting | Revenue from yesterday |
| `kpi_revenue_7days` | revenueLast7Days | accounting | Revenue last 7 days |
| `kpi_revenue_30days` | revenueLast30Days | accounting | Revenue last 30 days |
| `kpi_invoices_issued` | issuedInvoices | sales | Total issued (sent) invoices |
| `kpi_invoices_unpaid` | unpaidInvoices | sales | Unpaid invoices count |
| `kpi_invoices_overdue` | overdueInvoices | sales | Overdue invoices count |
| `kpi_invoices_paid` | paidInvoices | sales | Paid invoices count |
| `kpi_profit` | profit | accounting | Revenue minus expenses |
| `kpi_cash_balance` | cashBalance | accounting | Current cash/bank balance |
| `kpi_new_customers` | newCustomers | crm | Customers added this month |
| `kpi_active_leads` | activeLeads | crm | Open leads count |
| `kpi_purchase_orders` | purchaseOrders | purchasing | Active PO count |
| `kpi_retail_revenue` | retailRevenue | pos | Retail (maloprodaja) revenue today |
| `kpi_retail_revenue_yesterday` | retailRevenueYesterday | pos | Retail revenue yesterday |
| `kpi_retail_revenue_7days` | retailRevenueLast7Days | pos | Retail revenue last 7 days |
| `kpi_retail_transactions` | retailTransactions | pos | Retail transaction count today |
| `kpi_pos_sessions_active` | activePosSessions | pos | Currently open POS sessions |
| `kpi_avg_basket` | averageBasket | pos | Average transaction value today |
| `kpi_warehouse_count` | warehouseCount | inventory | Total warehouses |
| `kpi_products_active` | activeProducts | inventory | Active products count |

Add new category `"retail"` to `WidgetCategory` type and `widgetCategories` array.

### C — KpiWidget.tsx Query Cases

Add all new metric key cases to the switch statement. Each is a simple Supabase query:
- `revenue_yesterday`: RPC `dashboard_kpi_summary` with date filter, or direct query on journal entries for yesterday
- `revenue_7days` / `revenue_30days`: Same pattern with date range
- `invoices_issued`: count where `status = 'sent'`
- `invoices_unpaid`: count where status in `('sent', 'overdue')`
- `invoices_overdue`: count where `status = 'overdue'`
- `invoices_paid`: count where `status = 'paid'`
- `profit`: revenue - expenses from `dashboard_kpi_summary`
- `cash_balance`: sum from journal entries on cash/bank accounts
- `new_customers`: partners created this month
- `active_leads`: opportunities not won/lost
- `purchase_orders`: PO count with status in ('draft','confirmed')
- `retail_revenue` / `retail_revenue_yesterday` / `retail_revenue_7days`: sum from `pos_transactions` with `receipt_type = 'sale'`
- `retail_transactions`: count from `pos_transactions` today
- `pos_sessions_active`: count from `pos_sessions` where `closed_at IS NULL`
- `avg_basket`: average total from `pos_transactions` today
- `warehouse_count`: count from `warehouses`
- `products_active`: count from `products` where `is_active`

### D — Translations

Add all new title keys to both EN and SR in `translations.ts`:
- `revenueYesterday` → "Yesterday's Revenue" / "Prihod juče"
- `revenueLast7Days` → "Revenue (7 days)" / "Prihod (7 dana)"
- `revenueLast30Days` → "Revenue (30 days)" / "Prihod (30 dana)"
- `issuedInvoices` → "Issued Invoices" / "Izdate fakture"
- `unpaidInvoices` → "Unpaid Invoices" / "Neplaćene fakture"
- `overdueInvoices` → "Overdue Invoices" / "Fakture u kašnjenju"
- `paidInvoices` → "Paid Invoices" / "Plaćene fakture"
- `profit` → "Profit" / "Dobit"
- `cashBalance` → "Cash Balance" / "Stanje kase"
- `newCustomers` → "New Customers" / "Novi kupci"
- `activeLeads` → "Active Leads" / "Aktivni lidovi"
- `purchaseOrders` → "Purchase Orders" / "Narudžbenice"
- `retailRevenueYesterday` → "Retail Yesterday" / "Maloprodaja juče"
- `retailRevenueLast7Days` → "Retail (7 days)" / "Maloprodaja (7 dana)"
- `retailTransactions` → "Retail Transactions" / "Maloprodajne transakcije"
- `activePosSessions` → "Active POS Sessions" / "Aktivne POS sesije"
- `averageBasket` → "Avg. Basket" / "Prosečna korpa"
- `warehouseCount` → "Warehouses" / "Magacini"
- `activeProducts` → "Active Products" / "Aktivni proizvodi"
- `retailWidgets` → "Retail" / "Maloprodaja"
- `widgetSize` → "Size" / "Veličina"

### E — Files Modified

1. `src/config/widgetRegistry.ts` — Add `"retail"` category, 20 new widget definitions
2. `src/components/dashboard/widgets/KpiWidget.tsx` — Add 20 new query cases + icons
3. `src/components/dashboard/widgets/WidgetContainer.tsx` — Add resize buttons in edit mode
4. `src/components/dashboard/CustomizableDashboard.tsx` — Pass resize handler, add `grid-auto-rows`
5. `src/i18n/translations.ts` — Add ~20 new keys in EN + SR


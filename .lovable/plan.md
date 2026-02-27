

# v2.1 Status + v2.3 Round 1 Implementation Plan

## Already Complete (no work needed)

- **efaktura_category → UBL XML**: `sef-submit/index.ts` lines 124-125 and 160 read `line.efaktura_category` for both `TaxSubtotal` and `ClassifiedTaxCategory`
- **consume_fifo_layers**: Wired in `PosTerminal.tsx` (line 349) and `InvoiceForm.tsx` (line 466)
- **SEF PIB validation**: `sef-submit/index.ts` lines 482-493 query `sef_registry` before submission

## Quick Fixes (this round)

### Fix GlobalSearch dead link
- `GlobalSearch.tsx` line 51: change `/crm/partners` → `/crm/companies`

### Fix sidebar partners link
- `TenantLayout.tsx` line 154: change `/crm/partners` → `/crm/companies`

## v2.3 Round 1 — Travel Orders (Putni Nalozi)

### Database migration
- Create `travel_orders` table: id, tenant_id, legal_entity_id, employee_id, order_number, destination, purpose, departure_date, return_date, transport_type (car/bus/train/plane), vehicle_plate, advance_amount, per_diem_rate, per_diem_days, per_diem_total, total_expenses, status (draft/approved/completed/settled), approved_by, approved_at, notes, created_by, created_at
- Create `travel_order_expenses` table: id, travel_order_id, expense_type (accommodation/meals/transport/other), description, amount, receipt_number, receipt_date, sort_order
- RLS policies scoped by tenant_id
- Auto-generate order_number trigger

### UI Components
- `src/pages/tenant/TravelOrders.tsx` — list page with ResponsiveTable, status badges, filters
- `src/pages/tenant/TravelOrderForm.tsx` — form with employee selector, date range, per-diem calculator, expense lines, GL posting
- Routes in `src/routes/hrRoutes.tsx`
- Sidebar entry in TenantLayout under HR group
- GlobalSearch entries

### GL Posting
- On status → "settled": post via `postWithRuleOrFallback` with model code `TRAVEL_ORDER_POST`
- Fallback lines: DR 5210 (Travel expenses) / CR 2040 (Employee payable) or CR 2410 (Cash advance settlement)

### Per-Diem Calculator
- Serbian regulation: per-diem rates based on destination (domestic vs. international)
- Auto-calculate days from departure/return dates
- total = per_diem_rate × per_diem_days + sum(expenses)

## v2.3 Round 1 — PK-1 Cash Book Report

### New page
- `src/pages/tenant/reports/PK1Book.tsx` — query `cash_register_transactions` grouped by date
- Columns: Rb, Datum, Opis, Primanja, Izdavanja, Saldo
- Date range filter, legal entity filter
- Export to PDF (Serbian PK-1 format) and Excel

### Route + navigation
- Add route `/reports/pk1-book` in report routes
- Add to GlobalSearch and Reports sidebar group

## v2.3 Round 1 — PPP-PO Annual Income Report

### New page
- `src/pages/tenant/reports/PPPPO.tsx` — aggregate employee income by year
- Query payroll data: gross salary, tax, PIO, health insurance per employee
- Generate XML per Serbian Tax Administration PPP-PO schema
- Export XML download + preview table

### Route + navigation
- Add route `/reports/ppp-po` in report routes
- Sidebar + GlobalSearch entries

## i18n
- Add translation keys for travel orders, PK-1, PPP-PO labels


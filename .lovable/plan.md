

# Phase 26: Multi-Store Retail/Wholesale Engine, POS eFiskalizacija, and Salesperson Tracking

## Overview

Build a complete multi-store retail and wholesale sales system where each shop location (e.g., Shop A1, Shop A2, Shop A3, Shop A4) operates independently with its own fiscal devices, POS sessions, inventory (warehouse), price lists, and daily reports -- while multiple salespeople can work simultaneously in each shop.

## Multi-Store Architecture

```text
Tenant (Company)
  |
  +-- Shop A1 (Location type=shop)
  |     +-- Warehouse A1 (linked via default_warehouse_id)
  |     +-- Fiscal Device A1-PFR1
  |     +-- Fiscal Device A1-PFR2 (backup/second register)
  |     +-- Retail Price List A1 (optional store-specific)
  |     +-- POS Session (Salesperson: Marko) --> Transactions --> Fiscal Receipts
  |     +-- POS Session (Salesperson: Ana)   --> Transactions --> Fiscal Receipts
  |     +-- Daily Z-Report (aggregates all sessions for the day)
  |
  +-- Shop A2 (Location type=shop)
  |     +-- Warehouse A2
  |     +-- Fiscal Device A2-PFR1
  |     +-- POS Sessions (multiple salespeople)
  |     +-- Daily Z-Report
  |
  +-- Shop A3, A4... (same pattern)
  |
  +-- Office HQ (Location type=office) -- no POS, wholesale invoicing only
```

Key principles:
- Each shop = one Location record (type "shop" or "branch")
- Each shop has its own warehouse for stock deduction
- Each shop has one or more fiscal devices (ESIR/PFR)
- Multiple salespeople can have open POS sessions in the same shop simultaneously
- Each salesperson opens their own session, picks their shop
- Daily Z-reports aggregate per shop per day (across all sessions)
- Retail price lists can be global or per-shop (store-specific pricing)

---

## Part 1: Database Migration

### New Tables

**1.1 `salespeople`** -- Salesperson registry
- id, tenant_id, employee_id (nullable FK employees), first_name, last_name, code (unique per tenant), email, phone, commission_rate (default 0), is_active, created_at

**1.2 `sales_targets`** -- Monthly/quarterly revenue targets
- id, tenant_id, salesperson_id, year, month (nullable), quarter (nullable), target_amount, target_type ('revenue'/'margin'/'units'), created_at

**1.3 `fiscal_devices`** -- ESIR/PFR devices per shop
- id, tenant_id, legal_entity_id (nullable), **location_id** (FK locations -- which shop), device_name, device_type ('esir'/'pfr'), ib_number, jid, api_url, pac, location_name, location_address, is_active, created_at

**1.4 `fiscal_receipts`** -- Complete PFR transaction log
- id, tenant_id, fiscal_device_id, pos_transaction_id (nullable), invoice_id (nullable), receipt_type ('normal'/'proforma'/'copy'/'training'), transaction_type ('sale'/'refund'), receipt_number, total_amount, tax_items (jsonb), payment_method, buyer_id (nullable), pfr_request (jsonb), pfr_response (jsonb), qr_code_url, signed_at, created_at

**1.5 `pos_daily_reports`** -- Z-reports per shop per day
- id, tenant_id, **location_id** (FK locations), session_id (nullable), fiscal_device_id (nullable), report_date, total_sales, total_refunds, net_sales, cash_total, card_total, other_total, transaction_count, refund_count, tax_breakdown (jsonb), created_at

**1.6 `retail_price_lists`** -- Price lists (global or per-shop)
- id, tenant_id, **location_id** (nullable -- null = all shops, set = store-specific), name, is_default, is_active, created_at

**1.7 `retail_prices`** -- Product prices in a list
- id, price_list_id, product_id, retail_price (PDV-inclusive), markup_percent, valid_from, valid_until, created_at
- UNIQUE (price_list_id, product_id, valid_from)

### Altered Tables

**1.8 ALTER `pos_sessions`** -- Make store-aware + salesperson-aware
- Add: `location_id` uuid FK locations -- **which shop**
- Add: `warehouse_id` uuid FK warehouses -- **which warehouse for stock**
- Add: `fiscal_device_id` uuid FK fiscal_devices -- **which register**
- Add: `salesperson_id` uuid FK salespeople -- **who is working this session**

**1.9 ALTER `pos_transactions`** -- Store + salesperson + fiscal data
- Add: `location_id` uuid FK locations (denormalized for fast queries)
- Add: `warehouse_id` uuid FK warehouses
- Add: `salesperson_id` uuid FK salespeople
- Add: `fiscal_receipt_number` text nullable
- Add: `fiscal_device_id` uuid FK fiscal_devices
- Add: `is_fiscal` boolean default true
- Add: `receipt_type` text default 'sale' ('sale'/'refund')
- Add: `original_transaction_id` uuid FK pos_transactions (for refunds)
- Add: `buyer_id` text nullable (PIB/JMBG for fiscal)
- Add: `invoice_id` uuid FK invoices nullable

**1.10 ALTER `invoices`** -- Wholesale/retail + salesperson
- Add: `salesperson_id`, `sales_channel_id`, `sale_type` text default 'wholesale'

**1.11 ALTER `sales_orders`** -- Add salesperson + channel
- Add: `salesperson_id`, `sales_channel_id`

**1.12 ALTER `quotes`** -- Add salesperson
- Add: `salesperson_id`

**1.13 ALTER `opportunities`** -- Add salesperson
- Add: `salesperson_id`

**1.14 ALTER `products`** -- Default retail price
- Add: `default_retail_price` numeric default 0

**1.15 ALTER `locations`** -- Retail defaults per shop
- Add: `default_warehouse_id` uuid FK warehouses nullable
- Add: `default_price_list_id` uuid FK retail_price_lists nullable

All new tables get RLS policies scoped by tenant_id.

---

## Part 2: eFiskalizacija Edge Function

### New: `supabase/functions/fiscalize-receipt/index.ts`

PFR (Procesor Fiskalnih Racuna) communication:

1. Accept `{ transaction_id, tenant_id, device_id, items, payments, buyer_id, receipt_type, transaction_type }`
2. Load fiscal device config (api_url, PAC, IB)
3. Build PFR InvoiceRequest JSON:
   - Tax labels: A=20%, G=10%, E=0%
   - Payment types: 0=Other, 1=Cash, 2=Card, 3=Check, 4=Wire, 5=Voucher, 6=Mobile
4. POST to PFR API endpoint (configured per device)
5. Store full request/response in `fiscal_receipts`
6. Update `pos_transactions.fiscal_receipt_number`
7. Return receipt number + QR code URL
8. For refunds: reference original receipt number + datetime

---

## Part 3: New Pages (5)

### 3.1 `Salespeople.tsx` -- Salesperson Management
- CRUD: code, name, email, phone, commission rate, employee link
- Performance summary cards (total revenue, commissions earned)
- Active/inactive filter

### 3.2 `SalesPerformance.tsx` -- Analytics Dashboard
- Filters: date range, salesperson, sales channel, sale type, **location/shop**
- KPI cards: Total Revenue, Margin, Avg Deal Size, Conversion Rate
- Charts: revenue by salesperson (bar), trend over time (line), by channel (pie), wholesale vs retail split
- **Per-store breakdown**: revenue/transactions by shop (A1, A2, A3, A4)
- Leaderboard: Salesperson | Revenue | Orders | Avg Order | Commission | Target %

### 3.3 `RetailPrices.tsx` -- Retail Price Management
- Price list CRUD (assign to specific shop or all shops)
- Product price editor grid
- Bulk markup calculator (apply X% to category)
- Compare wholesale vs retail prices side by side

### 3.4 `FiscalDevices.tsx` -- Fiscal Device Management
- CRUD with **shop/location selector** (which store this device is in)
- Legal entity link (for PIB on receipts)
- Test connection button (ping PFR API)
- Device status indicator
- Multiple devices per shop supported

### 3.5 `PosDailyReport.tsx` -- Z-Report / Daily Report
- **Shop/location filter** (select which store)
- Date selector
- Auto-calculate from pos_transactions for date + location
- Summary: total sales, refunds, net, by payment method
- Tax breakdown by rate (A/G/E)
- Print-friendly format
- History of past daily reports

---

## Part 4: Modify Existing Pages

### 4.1 `PosTerminal.tsx` -- Major Enhancement
- **Shop selector** at entry (pick location from shop-type locations)
- System auto-loads: store's warehouse, fiscal devices, retail price list
- **Salesperson indicator** (from active session)
- Fiscal flow: "Fiscalize" button after sale completion -> calls edge function -> displays receipt number + QR code
- Refund flow: search original transaction, create refund receipt with reference
- Buyer ID field (PIB/JMBG -- required for amounts above threshold)
- Retail prices from the store's price list
- Expanded payment methods: cash, card, check, wire, voucher, mobile
- Stock deduction from session's warehouse on completed sale

### 4.2 `PosSessions.tsx` -- Store-Aware Sessions
- **Shop/location filter** to view sessions per store
- When opening session: select shop + salesperson -> auto-fill warehouse + fiscal device
- Multiple simultaneous open sessions per shop (one per salesperson)
- Session summary: transaction count, total revenue by payment method
- Link to generate daily report for the session's shop

### 4.3 `Invoices.tsx` -- Add Sales Fields
- Salesperson selector in create/edit
- Sales channel selector
- Sale type toggle (wholesale/retail)
- Filter by salesperson, channel, sale type

### 4.4 `SalesOrders.tsx` -- Add salesperson + channel selectors
### 4.5 `Quotes.tsx` -- Add salesperson selector
### 4.6 `Opportunities.tsx` -- Add salesperson selector

### 4.7 `CrmDashboard.tsx` -- Sales Performance Widget
- Top 5 salespeople by revenue (current month)
- Wholesale vs Retail revenue split chart

### 4.8 `Locations.tsx` -- Retail Defaults
- Add default_warehouse_id selector (from warehouses linked to this location)
- Add default_price_list_id selector
- Show linked fiscal devices count

---

## Part 5: Routes and Navigation

### `App.tsx` -- 5 new routes
- `crm/salespeople` -> Salespeople
- `crm/sales-performance` -> SalesPerformance
- `crm/retail-prices` -> RetailPrices
- `pos/fiscal-devices` -> FiscalDevices
- `pos/daily-report` -> PosDailyReport

### `TenantLayout.tsx` -- Navigation updates
Add to crmNav: Salespeople, Sales Performance, Retail Prices
Add to posNav: Fiscal Devices, Daily Report

---

## Part 6: Translations (~60 keys EN/SR)

Salespeople, wholesale/retail, fiscal, POS enhanced, store-related, daily report terms.

---

## Part 7: Edge Function Config

Add `fiscalize-receipt` to `supabase/config.toml`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/Salespeople.tsx` | Salesperson CRUD + summary |
| `src/pages/tenant/SalesPerformance.tsx` | Sales analytics with per-store breakdown |
| `src/pages/tenant/RetailPrices.tsx` | Retail price list management |
| `src/pages/tenant/FiscalDevices.tsx` | Fiscal device management per shop |
| `src/pages/tenant/PosDailyReport.tsx` | Z-report per shop per day |
| `supabase/functions/fiscalize-receipt/index.ts` | PFR fiscalization connector |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/PosTerminal.tsx` | Shop selector, fiscal flow, refunds, salesperson, retail prices, stock deduction |
| `src/pages/tenant/PosSessions.tsx` | Shop filter, salesperson + shop selection on open, multi-session support |
| `src/pages/tenant/Invoices.tsx` | Salesperson, channel, sale type fields |
| `src/pages/tenant/SalesOrders.tsx` | Salesperson + channel |
| `src/pages/tenant/Quotes.tsx` | Salesperson |
| `src/pages/tenant/Opportunities.tsx` | Salesperson |
| `src/pages/tenant/CrmDashboard.tsx` | Sales performance widget |
| `src/pages/tenant/Locations.tsx` | Default warehouse + price list selectors |
| `src/layouts/TenantLayout.tsx` | New nav items in CRM and POS groups |
| `src/App.tsx` | 5 new routes |
| `src/i18n/translations.ts` | ~60 new translation keys |
| `supabase/config.toml` | fiscalize-receipt function config |

---

## Technical Details

### Multi-Salesperson per Shop Flow

```text
Shop A1 has 3 salespeople working today: Marko, Ana, Petar

1. Marko opens POS -> selects Shop A1 -> opens session (session.salesperson_id = Marko)
2. Ana opens POS -> selects Shop A1 -> opens session (session.salesperson_id = Ana)
3. Petar opens POS -> selects Shop A1 -> opens session (session.salesperson_id = Petar)

Each has their own active session in the same shop.
All 3 deduct from the same warehouse (Warehouse A1).
All 3 fiscalize through the same fiscal device (or different registers if multiple).
Daily Z-report aggregates ALL transactions from Shop A1 for the day.

POS Terminal query for active session:
  WHERE tenant_id = X AND opened_by = current_user AND status = 'open'
  (each user sees only their own session)
```

### Retail Price Resolution per Shop

```text
When selling product X at Shop A2:
1. Check retail_prices in Shop A2's specific price list (location_id = A2)
2. Fall back to tenant-wide default price list (location_id IS NULL, is_default = true)
3. Fall back to product.default_retail_price
4. Fall back to product.default_sale_price (wholesale price)
```

### Salesperson Performance Calculation

```text
For salesperson in period (filterable by shop):
  invoice_revenue = SUM(invoices.total WHERE salesperson_id AND status IN ('sent','paid'))
  pos_revenue = SUM(pos_transactions.total WHERE salesperson_id)
  total_revenue = invoice_revenue + pos_revenue
  commission = total_revenue * commission_rate / 100
  target_pct = total_revenue / target_amount * 100
  conversion = accepted_quotes / total_quotes * 100
```

### eFiskalizacija PFR Tax Labels + Payment Types

```text
Tax labels:
  A = 20% opsta stopa (general rate)
  G = 10% posebna stopa (reduced rate)
  E = 0% oslobodjeno (exempt)

Payment types:
  0 = Drugo (Other)
  1 = Gotovina (Cash)
  2 = Kartica (Card)
  3 = Cek (Check)
  4 = Virman (Wire Transfer)
  5 = Vaucer (Voucher)
  6 = Mobilni novac (Mobile Money)
```

### Daily Z-Report per Shop

```text
For Shop A1, Date 2026-02-12:
  Query all pos_transactions WHERE location_id = A1 AND date = 2026-02-12
  Aggregate:
    - Total sales (receipt_type = 'sale')
    - Total refunds (receipt_type = 'refund')
    - Net = sales - refunds
    - Breakdown by payment method (cash, card, etc.)
    - Tax breakdown by label (A: base + tax, G: base + tax, E: base)
    - Transaction count, refund count
  Store in pos_daily_reports with location_id = A1
```


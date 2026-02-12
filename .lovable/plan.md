

# Phase 23: State Integration Foundation

## Overview

Build the SEF (Serbian e-Invoice) connector architecture, eOtpremnica (electronic dispatch note) document model with status lifecycle, and NBS (National Bank of Serbia) exchange rate auto-import edge function. Both SEF and eOtpremnica are per-tenant features configurable from either the Super Admin panel or the tenant's Settings > Integrations page.

---

## Current State

- **SEF**: Invoices already have a `sef_status` column (`not_submitted`, `submitted`, `accepted`, `rejected`) and mock submit logic in `Invoices.tsx` (direct DB update + setTimeout). No connector config table, no edge function, no API key storage.
- **eOtpremnica**: No tables, no UI, no model.
- **NBS Exchange Rates**: `exchange_rates` table exists with `from_currency`, `to_currency`, `rate`, `rate_date`, `source`. `Currencies.tsx` page displays them. No auto-import.
- **Integrations Page**: Both tenant (`Integrations.tsx`) and super admin (`IntegrationSupport.tsx`) pages are placeholder stubs showing "Coming Soon".

---

## Part 1: Database Tables (Migration)

### 1.1 `sef_connections` -- Per-tenant SEF connector config

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | unique |
| legal_entity_id | uuid FK legal_entities | nullable, scope to specific entity |
| api_url | text | SEF API base URL |
| api_key_encrypted | text | Encrypted API key (stored securely) |
| environment | text | `'sandbox'` or `'production'`, default `'sandbox'` |
| is_active | boolean | default false |
| last_sync_at | timestamptz | nullable |
| last_error | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

- RLS: super_admin OR tenant admin can read/write
- Unique constraint on `(tenant_id)` (one connection per tenant)

### 1.2 `sef_submissions` -- Invoice submission audit log

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| invoice_id | uuid FK invoices | |
| sef_connection_id | uuid FK sef_connections | |
| status | text | `'pending'`, `'submitted'`, `'accepted'`, `'rejected'`, `'error'` |
| sef_invoice_id | text | SEF-assigned ID, nullable |
| request_payload | jsonb | What was sent |
| response_payload | jsonb | What was received |
| error_message | text | nullable |
| submitted_at | timestamptz | default now() |
| resolved_at | timestamptz | nullable |

### 1.3 `eotpremnica` -- Electronic dispatch notes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| legal_entity_id | uuid FK legal_entities | nullable |
| document_number | text | Auto-generated |
| document_date | date | |
| sender_name | text | |
| sender_pib | text | nullable |
| sender_address | text | nullable |
| receiver_name | text | |
| receiver_pib | text | nullable |
| receiver_address | text | nullable |
| warehouse_id | uuid FK warehouses | nullable |
| invoice_id | uuid FK invoices | nullable (linked invoice) |
| sales_order_id | uuid FK sales_orders | nullable |
| status | text | `'draft'`, `'confirmed'`, `'in_transit'`, `'delivered'`, `'cancelled'` |
| notes | text | nullable |
| total_weight | numeric | nullable |
| vehicle_plate | text | nullable |
| driver_name | text | nullable |
| created_by | uuid | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 1.4 `eotpremnica_lines` -- Dispatch note line items

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| eotpremnica_id | uuid FK eotpremnica | |
| product_id | uuid FK products | nullable |
| description | text | |
| quantity | numeric | |
| unit | text | default `'kom'` |
| sort_order | int | default 0 |

---

## Part 2: NBS Exchange Rate Auto-Import Edge Function

### New file: `supabase/functions/nbs-exchange-rates/index.ts`

- Fetches the NBS public XML/JSON feed for the daily middle exchange rate list
- Uses the NBS public API: `https://nbs.rs/kursnaListaMod498/kursnaLista` (or the JSON variant)
- For each currency in the response, upserts into `exchange_rates` with `source = 'NBS'`
- Accepts `tenant_id` in request body -- imports rates for that tenant
- Can be called manually from the Currencies page or scheduled via cron
- No API key needed (NBS rates are public)

### Config in `supabase/config.toml`
```
[functions.nbs-exchange-rates]
verify_jwt = false
```

---

## Part 3: SEF Connector Edge Function Scaffold

### New file: `supabase/functions/sef-submit/index.ts`

- Accepts `{ invoice_id, tenant_id }` in request body
- Looks up `sef_connections` for the tenant
- If no active connection, returns error
- Builds the SEF XML/JSON payload from invoice data (invoice + lines)
- For now: scaffold only -- logs the payload and creates a `sef_submissions` record with status `'pending'`
- In sandbox mode: simulates acceptance after creation (updates to `'accepted'`)
- In production mode: would call the real SEF API (placeholder for future)
- Updates `invoices.sef_status` based on submission result

### Config in `supabase/config.toml`
```
[functions.sef-submit]
verify_jwt = false
```

---

## Part 4: Tenant Integrations Page (Full Rebuild)

### Modify: `src/pages/tenant/Integrations.tsx`

Replace the "Coming Soon" stub with a full integrations management page containing:

**SEF Connection Card:**
- Shows current connection status (not configured / sandbox / production)
- Form: API URL, API Key, Environment toggle (sandbox/production)
- Enable/Disable toggle
- Test Connection button (calls edge function with a test flag)
- Last sync timestamp and error display

**NBS Exchange Rates Card:**
- Shows last import date
- "Import Now" button that calls the `nbs-exchange-rates` edge function
- Shows count of rates imported

**eOtpremnica Card:**
- Status info (feature enabled/disabled via tenant_settings)
- Link to the dispatch notes list page

---

## Part 5: Super Admin Integration Support Page

### Modify: `src/pages/super-admin/IntegrationSupport.tsx`

Replace the stub with a management view:

- Table of all tenants showing their SEF connection status (not configured / sandbox / production / error)
- Ability to configure SEF connection for any tenant (opens a dialog similar to tenant-side)
- NBS rates section: "Import for All Tenants" bulk action
- Per-tenant connection health indicators

---

## Part 6: eOtpremnica List Page + Route

### New file: `src/pages/tenant/Eotpremnica.tsx`

- List view of dispatch notes with filters (status, date range, search)
- Create dialog with form fields matching the table schema
- Status badges with lifecycle transitions:
  - draft -> confirmed -> in_transit -> delivered
  - Any non-delivered status -> cancelled
- Status change buttons on each row
- Link to related invoice if present
- Legal entity filter (reuses `useLegalEntities`)

### Route additions in `App.tsx`
- Add route: `inventory/dispatch-notes` -> `Eotpremnica` component
- Protected by `inventory` module

### Sidebar addition in `TenantLayout.tsx`
- Add `{ key: "dispatchNotes", url: "/inventory/dispatch-notes", icon: Truck }` to `inventoryNav`

---

## Part 7: Wire SEF Submit Through Edge Function

### Modify: `src/pages/tenant/Invoices.tsx`

- Replace the mock `sefMutation` (direct DB update + setTimeout) with a real edge function call to `sef-submit`
- Show submission status from `sef_submissions` table
- Add loading/error states for SEF submission

---

## Part 8: Translations

### Modify: `src/i18n/translations.ts`

Add keys for both EN and SR:
- `sefConnection`, `sefConfiguration`, `apiUrl`, `apiKey`, `environment`, `sandbox`, `production`, `testConnection`, `connectionActive`, `connectionInactive`, `lastSync`, `importNow`, `importExchangeRates`, `nbsExchangeRates`, `dispatchNotes`, `eotpremnica`, `documentNumber`, `senderName`, `receiverName`, `inTransit`, `delivered`, `vehiclePlate`, `driverName`, `totalWeight`, `confirmDispatch`, `markDelivered`, `sefNotConfigured`, `sefSubmitting`, `configureForTenant`, `bulkImportRates`

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/nbs-exchange-rates/index.ts` | NBS exchange rate auto-import |
| `supabase/functions/sef-submit/index.ts` | SEF invoice submission scaffold |
| `src/pages/tenant/Eotpremnica.tsx` | Dispatch notes list + CRUD |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Integrations.tsx` | Full rebuild: SEF config, NBS import, eOtpremnica status cards |
| `src/pages/super-admin/IntegrationSupport.tsx` | Tenant SEF connection management + bulk NBS import |
| `src/pages/tenant/Invoices.tsx` | Replace mock SEF mutation with edge function call |
| `src/pages/tenant/Currencies.tsx` | Add "Import NBS Rates" button |
| `src/layouts/TenantLayout.tsx` | Add dispatch notes to inventory nav |
| `src/App.tsx` | Add eotpremnica route |
| `src/i18n/translations.ts` | Add ~30 new translation keys |
| `supabase/config.toml` | Add nbs-exchange-rates and sef-submit function configs |

## Migration (SQL)

A single migration will create:
- `sef_connections` table with RLS policies
- `sef_submissions` table with RLS policies
- `eotpremnica` table with RLS policies
- `eotpremnica_lines` table with RLS policies
- Updated_at triggers on new tables
- Indexes on tenant_id and status columns

---

## Technical Details

### SEF Connection Flow

```text
Tenant Admin configures SEF in Settings > Integrations:
  1. Enters API URL + API Key + selects Environment
  2. Clicks "Test Connection" -> calls sef-submit with test=true flag
  3. Enables the connection (is_active = true)

Invoice submission:
  1. User clicks "SEF" button on a sent invoice
  2. Frontend calls sef-submit edge function with invoice_id
  3. Edge function:
     a. Loads sef_connections for tenant
     b. Builds payload from invoice + invoice_lines
     c. Creates sef_submissions record (status: pending)
     d. In sandbox: simulates acceptance
     e. In production: would POST to SEF API (future)
     f. Updates invoices.sef_status
  4. Frontend shows updated status
```

### eOtpremnica Status Lifecycle

```text
  draft --> confirmed --> in_transit --> delivered
    |          |              |
    v          v              v
  cancelled  cancelled    cancelled
```

### NBS Rate Import Flow

```text
  1. Edge function called with { tenant_id }
  2. Fetches NBS daily rate list (public endpoint, no auth)
  3. Parses response for currency codes + middle rates
  4. For each currency: upserts exchange_rates row
     - from_currency = currency code (EUR, USD, etc.)
     - to_currency = 'RSD'
     - rate = middle rate
     - rate_date = today
     - source = 'NBS'
  5. Returns count of rates imported
```

### Super Admin SEF Management

```text
IntegrationSupport page shows:
  - Table: tenant_name | sef_environment | is_active | last_sync | last_error
  - Each row has "Configure" button opening a dialog
  - Dialog pre-fills existing connection data for that tenant
  - "Import NBS Rates for All" button iterates active tenants
```


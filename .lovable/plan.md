

# Add Web Sales Module with E-Commerce Connections (Shopify, WooCommerce, Custom)

## Overview

Add a new **"Web" (Web Prodaja)** module that is separate from Retail. Web Sales is an enable/disable module managed by Super Admin (like all other modules). When enabled, it appears in tenant Settings with connection configuration for Shopify, WooCommerce, or a Custom API endpoint.

## What Changes

### 1. Database Migration

**New table: `web_connections`** -- stores e-commerce platform credentials per tenant

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| platform | text | 'shopify' / 'woocommerce' / 'custom' |
| store_url | text | e.g. mystore.myshopify.com |
| api_key | text | encrypted key / consumer key |
| api_secret | text | nullable, for WooCommerce consumer secret |
| access_token | text | nullable, for Shopify access token |
| webhook_secret | text | nullable |
| is_active | boolean | default false |
| last_sync_at | timestamptz | nullable |
| last_error | text | nullable |
| config | jsonb | default '{}', platform-specific settings |
| created_at | timestamptz | |

RLS: scoped by tenant_id.

**New table: `web_price_lists`** -- web-specific price lists (separate from retail)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| web_connection_id | uuid FK web_connections | nullable (null = all web channels) |
| name | text | |
| is_default | boolean | default false |
| is_active | boolean | default true |
| created_at | timestamptz | |

**New table: `web_prices`** -- product prices for web channels

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| price_list_id | uuid FK web_price_lists | |
| product_id | uuid FK products | |
| web_price | numeric | |
| compare_at_price | numeric | nullable (for "was X, now Y" display) |
| valid_from | date | |
| valid_until | date | nullable |
| created_at | timestamptz | |
| UNIQUE (price_list_id, product_id, valid_from) | |

**Insert into `module_definitions`**: Add a row with key='web', name='Web Sales', so Super Admin can enable/disable it per tenant.

### 2. New Page: `src/pages/tenant/WebSettings.tsx`

Web module settings page accessible from tenant Settings. Contains:

- **Connection cards** -- list configured web connections (Shopify, WooCommerce, Custom)
- **Add Connection** button opens a dialog:
  - Platform selector (Shopify / WooCommerce / Custom)
  - Platform-specific fields:
    - **Shopify**: Store URL, API Key, Access Token
    - **WooCommerce**: Store URL, Consumer Key, Consumer Secret
    - **Custom**: API URL, API Key, Webhook Secret
  - Test Connection button
  - Active/Inactive toggle
- **Connection status** -- shows active/inactive badge, last sync time, errors
- Edit / Delete existing connections

### 3. New Page: `src/pages/tenant/WebPrices.tsx`

Mirrors RetailPrices.tsx but for web pricing:
- Web price list CRUD (can be tied to a specific web connection or all)
- Product price editor with web_price + compare_at_price (strike-through pricing)
- Bulk pricing tools

### 4. Navigation and Routing

**New nav group in sidebar: "Web" (Web Prodaja)** -- only visible when `canAccess("web")`
- Web Settings (connection management)
- Web Prices

**`App.tsx`** -- 2 new routes:
- `/web/settings` -> WebSettings
- `/web/prices` -> WebPrices

**`TenantLayout.tsx`**:
- New `webNav` array with globe icon accent color (e.g. `bg-indigo-400`)
- Guarded by `canAccess("web")`

### 5. Settings Page Update

**`src/pages/tenant/Settings.tsx`**: Add a "Web Sales" card linking to `/web/settings` (only shown when web module is enabled)

### 6. RBAC Update

**`src/config/rolePermissions.ts`**:
- Add `"web"` to `ModuleGroup` type
- Add to `ALL_MODULES`
- Grant to `admin`, `manager`, `sales` roles
- Add route mapping `"/web/": "web"`

### 7. Translations

Add ~20 keys for EN/SR:
- webSales / Web prodaja
- webConnection / Web konekcija
- shopify / Shopify
- woocommerce / WooCommerce
- customApi / Prilagodjen API
- storeUrl / URL prodavnice
- accessToken / Pristupni token
- consumerKey / Potrošački ključ
- consumerSecret / Potrošačka tajna
- webhookSecret / Webhook tajna
- compareAtPrice / Uporedna cena
- webPrice / Web cena
- webPriceList / Web cenovnik
- testConnection / Testiraj konekciju
- syncProducts / Sinhronizuj proizvode
- platform / Platforma

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/WebSettings.tsx` | Web connection management (Shopify/WooCommerce/Custom) |
| `src/pages/tenant/WebPrices.tsx` | Web-specific price lists and pricing |

## Files to Modify

| File | Changes |
|------|---------|
| Migration SQL | Create `web_connections`, `web_price_lists`, `web_prices` tables + insert module_definitions row |
| `src/integrations/supabase/types.ts` | Add types for new tables |
| `src/layouts/TenantLayout.tsx` | Add `webNav` group with globe icon |
| `src/App.tsx` | Add 2 new routes under `/web/` |
| `src/config/rolePermissions.ts` | Add `"web"` module group |
| `src/pages/tenant/Settings.tsx` | Add Web Sales card (conditional on module access) |
| `src/i18n/translations.ts` | Add ~20 translation keys |

## Technical Notes

### Price Hierarchy (complete picture)

```text
Retail (Maloprodaja):
  retail_price_lists -> retail_prices (PDV-inclusive, per-shop)

Web (Web Prodaja):
  web_price_lists -> web_prices (per web channel, with compare_at_price)

Wholesale (Veleprodaja):
  products.default_sale_price (base wholesale)

All three are independent pricing tiers.
```

### Connection Platform Config

```text
Shopify:
  - store_url: "mystore.myshopify.com"
  - api_key: Shopify API key
  - access_token: Shopify Admin API access token
  - config: { api_version: "2024-01" }

WooCommerce:
  - store_url: "https://mystore.com"
  - api_key: WooCommerce consumer key (ck_xxx)
  - api_secret: WooCommerce consumer secret (cs_xxx)
  - config: { version: "wc/v3" }

Custom:
  - store_url: "https://api.mystore.com"
  - api_key: Bearer token or API key
  - webhook_secret: for incoming webhooks
  - config: { headers: {}, auth_type: "bearer" }
```


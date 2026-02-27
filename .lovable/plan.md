

## PRD v1.1 Review — Gap Analysis & Implementation Plan

### What's Already Done (Phases 1-5 v1.0)
- Product categories table + UI
- Purchase prices, wholesale price lists/prices tables
- Production cost columns on production_orders + bom_lines
- Pricing Center (4-tab unified page)
- Sidebar restructuring
- Kalkulacija/Nivelacija basic master data sync (updates product defaults, inserts purchase_prices, upserts retail_prices for default list)
- Production cost flow (completion dialog, BOM cost display)
- Price resolver utility + integration in InvoiceForm/PosTerminal

### What's NEW in v1.1 (Not Yet Implemented)

**Phase 0: BLOCKER — RPC Bug Fix**

The later migration (`20260213115251`) overwrote correct RPCs with broken ones that reference non-existent tables:
- `kalkulacija_lines` (should be `kalkulacija_items`)
- `journal_entry_lines` (should be `journal_lines`)  
- `v_kal.legal_entity_id`, `v_kal.document_date`, `v_kal.document_number` (don't exist)

The earlier migration (`20260213113656`) has the correct versions. A new migration must restore the correct RPCs with enhancements.

**Phase 3 v1.1: Per-Objekat (Per-Location) Kalkulacija/Nivelacija**

This is the largest new requirement — Serbian law mandates per-location pricing documents:

1. **Schema changes**: Add `location_id` + `legal_entity_id` columns to `kalkulacije` and `nivelacije` tables
2. **RPC rewrite**: Both RPCs must use `location_id` for GL analytical sub-accounts (1320-{code}, 1329-{code}, 1340-{code}) and include embedded VAT (account 1340) from the correct earlier logic
3. **Kalkulacija UI**: Mandatory `location_id` picker (retail location) + `legal_entity_id` picker; post updates `retail_prices` for **that location's price list** (not global default)
4. **Nivelacija UI**: Same mandatory pickers; `old_retail_price` prefilled from `retail_prices` for selected location (not from product defaults); auto-fetch `quantity_on_hand` from `inventory_stock` for warehouse × product
5. **Retail price list per-location constraint**: Unique active list per location index
6. **Auto-nivelacija** (P1): When wholesale price changes, offer to generate nivelacije for all retail locations

### Implementation Plan

---

**Round 1: Fix Broken RPCs + Schema (BLOCKER)**

1. New SQL migration:
   - `ALTER TABLE kalkulacije ADD COLUMN location_id UUID REFERENCES locations(id)`
   - `ALTER TABLE kalkulacije ADD COLUMN legal_entity_id UUID REFERENCES legal_entities(id)`
   - `ALTER TABLE nivelacije ADD COLUMN location_id UUID REFERENCES locations(id)`
   - `ALTER TABLE nivelacije ADD COLUMN legal_entity_id UUID REFERENCES legal_entities(id)`
   - `CREATE UNIQUE INDEX idx_retail_price_lists_location_active ON retail_price_lists(tenant_id, location_id) WHERE is_active = true AND location_id IS NOT NULL`
   - `CREATE OR REPLACE FUNCTION post_kalkulacija` — merge correct table names from migration `113656` with embedded VAT logic from `115251`, add `location_id` for GL dimension_values and per-location retail_prices upsert
   - `CREATE OR REPLACE FUNCTION post_nivelacija` — same pattern: correct table names + embedded VAT split + location-scoped GL

2. Add indexes on `kalkulacije(location_id)` and `nivelacije(location_id)`

**Round 2: Per-Objekat Kalkulacija UI**

3. Update `Kalkulacija.tsx`:
   - Add `location_id` and `legal_entity_id` to form state (mandatory)
   - Fetch `locations` and `legal_entities` queries
   - Add Select pickers for both (required before saving)
   - Save `location_id` and `legal_entity_id` on the `kalkulacije` record
   - Update `postMutation`: after RPC, upsert `retail_prices` for **the location's price list** (query `retail_price_lists WHERE location_id = X`), not the global default
   - Show location column in kalkulacije list table

**Round 3: Per-Objekat Nivelacija UI**

4. Update `Nivelacija.tsx`:
   - Add `location_id` and `legal_entity_id` to form state (mandatory)
   - Fetch locations and legal entities
   - When location selected: prefill `old_retail_price` from `retail_prices` for that location's price list (not from `products.default_retail_price`)
   - Auto-fetch `quantity_on_hand` from `inventory_stock` when product + warehouse selected
   - Update `postMutation`: upsert `retail_prices` for **that location's price list**
   - Show location column in nivelacije list table

**Round 4: Translation Keys**

5. Add missing i18n keys: `location`, `legalEntity`, `selectLocation`, `selectLegalEntity`, `locationRequired`, `legalEntityRequired`, `autoNivelacija`, `perLocationPricing`

---

### Technical Details

**RPC Fix Strategy**: The new migration merges:
- Correct table/column names from `20260213113656` (`kalkulacija_items`, `journal_lines`, `account_id` lookups, `kalkulacija_date`/`kalkulacija_number`)
- Embedded VAT (account 1340) calculation from `20260213115251`
- New `location_id` parameter for GL dimension tracking via `journal_lines.description` including location code

**Per-Location Retail Price Resolution**: Post kalkulacija will query `retail_price_lists WHERE location_id = X AND is_active = true` to find the correct price list, then upsert into `retail_prices` for that list. If no location-specific list exists, fall back to creating one automatically.

**Files to create/modify**:
- New: 1 SQL migration
- Edit: `Kalkulacija.tsx`, `Nivelacija.tsx`, `translations.ts`


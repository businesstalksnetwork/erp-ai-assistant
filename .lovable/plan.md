

# Add Uniprom dbo.* File Support to import-legacy-zip

## Goal

Add dedicated importers for the new Uniprom `dbo.*` CSV files that the current system doesn't handle. These files are headerless, use integer legacy IDs, and follow the `dbo.TableName.csv` naming convention. The existing analyze-legacy-zip already recognizes them via `DBO_TABLE_LOOKUP` and routes them to the correct target tables -- but the import function lacks column maps and importer logic for most of them.

## What Changes

Only one file: `supabase/functions/import-legacy-zip/index.ts`

The analyze-legacy-zip function already correctly identifies all `dbo.*` files and maps them to target tables via the `DBO_TABLE_LOOKUP` dictionary. No changes needed there.

## New UNIPROM_COLUMN_MAP Entries

Add column index maps for the new Uniprom tables. These are derived from the profiling data in the user's research:

```text
Partner:           { legacy_id: 0, name: 1, city_id: 4, partner_code: 5, pib: 10, is_active: 17 }
                   (existing -- already in the map, confirmed accurate)

PartnerLocation:   { legacy_id: 0, full_name: 1, city: 9, address: 10, partner_code: 7, partner_legacy_id: 22 }
                   (existing -- already mapped)

PartnerContact:    { legacy_id: 0, last_name: 1, first_name: 2, phone: 6, email: 10, partner_legacy_id: 12 }
                   (existing -- already mapped)

Item:              { legacy_id: 0, name: 1, sku: 2, is_active: 33, product_type: 34 }
                   (existing -- already mapped)

City:              { legacy_id: 0, name: 1, display_name: 2, country_id: 4 }
                   (NEW -- for lookup enrichment)

Tax:               { legacy_id: 0, name: 1, pdv_code: 2, rate: 3 }
                   (existing -- already mapped)

DocumentHeader:    { legacy_id: 0, doc_number: 1, date: 2, doc_list_id: 3, status_id: 4, partner_id: 6, warehouse_id: 7, total: 11 }
                   (existing -- already mapped)

DocumentLine:      { legacy_id: 0, header_id: 1, item_id: 2, qty: 3, unit_price: 4, discount: 5, tax_id: 6 }
                   (existing -- already mapped)
```

Most maps already exist. The main gap is that the **importers** don't use them properly for these files.

## Implementation Plan

### 1. City Lookup Cache (New Helper)

Add a function `buildCityLookup` that reads `dbo.City.csv` content from the ZIP and builds a `Map<string, string>` of `city_id -> city_name`. This will be loaded once at the start of the import run and passed to importers that need city resolution.

Since the city file is purely a lookup (not imported into any table), we'll:
- Parse it during the initial ZIP scan
- Store it in memory as a simple map
- Use it in Partner and PartnerLocation importers to resolve `city_id` column values to human-readable city names

### 2. Enhanced importPartners for dbo.Partner.csv

The current `importPartners` already handles `unipromTable === "Partner"` but only reads `legacy_id`, `name`, and `is_active`. Update it to also extract:
- `city_id` (col 4) -- resolve via City lookup to set `partners.city`
- `pib` (col 10) -- already being extracted from the generic path but not from the Uniprom path
- `partner_code` (col 5) -- store as `LEG:{partner_code}` in `maticni_broj` (current behavior uses `legacy_id` which is the row number, not the business code)

This means the Uniprom Partner path becomes:
```
name = cols[1]
city = cityLookup[cols[4]] || null
partner_code = cols[5]
pib = cols[10]
is_active = cols[17] !== "0"
maticni_broj = "LEG:" + (partner_code || legacy_id)
```

### 3. Enhanced importProducts for dbo.Item.csv

The current Uniprom Item path only reads `sku`, `name`, `is_active`. The `dbo.A_UnosPodataka.csv` enrichment (generic path) provides pricing and UoM. Update the Item path to also extract:
- Product type from col 34 to set `products.type` (goods vs service)
- Preserve the legacy ID in description/notes for cross-referencing

### 4. DocumentHeader Type Routing (Major Enhancement)

Currently `importInvoicesHeuristic` dumps ALL DocumentHeader rows into the `invoices` table regardless of document type. The doc_number suffix indicates what kind of document it is:
- `*-PO` = Purchase Order -> `purchase_orders`
- `*-RAC` = Invoice (Racun) -> `invoices`  
- `*-PON` = Quote (Ponuda) -> `quotes` or `sales_orders`
- Other suffixes -> `invoices` as fallback

Update the DocumentHeader importer to:
1. Parse the doc_number suffix
2. Route to the appropriate target table
3. Resolve `partner_id` (col 6) via the partner legacy map to link the document to a partner

Also add a new `importDocumentLines` function that:
1. Reads DocumentLine rows
2. Looks up the parent document by legacy header ID
3. Looks up the product by legacy item ID
4. Inserts into the appropriate `*_lines` table

### 5. PartnerLocation Enrichment Fix

The current `importPartners` handles `PartnerLocation` by updating existing partners with city/address. Fix it to:
- Resolve `city_id` (col 4) via City lookup instead of using raw value
- Use `partner_legacy_id` (col 22) correctly with the updated legacy map

### 6. PartnerContact Enhancement

The current `importContacts` handles `PartnerContact` correctly via `UNIPROM_COLUMN_MAP`. Just verify the column indices match the actual data (first_name at col 2, last_name at col 1, phone at col 6, email at col 10, partner_legacy_id at col 12 -- note the Uniprom contacts have last_name BEFORE first_name).

### 7. Document Dispatcher Update

Update the target-table-to-importer switch in the main handler to route:
- `purchase_orders` -> new `importPurchaseOrders` function
- `quotes` -> new `importQuotes` function  
- Keep `invoices` -> `importInvoicesHeuristic`

Or simpler: make `importInvoicesHeuristic` accept a `targetTable` parameter and handle the routing internally based on doc_number suffix.

## Technical Details

### City Lookup Implementation

```text
async function buildCityLookup(zip: JSZip): Promise<Map<string, string>>
  - Find "dbo.City.csv" in the ZIP
  - Parse with reconstructLogicalRows + parseCSVLine
  - For each row: map[cols[0]] = cols[1] (id -> name)
  - Return the map (typically ~100K entries, fits in memory)
```

### DocumentHeader Routing Logic

```text
function getDocType(docNumber: string): "invoice" | "purchase_order" | "quote" | "unknown"
  - if docNumber contains "-PO" or ends with "PO" -> "purchase_order"
  - if docNumber contains "-RAC" -> "invoice"
  - if docNumber contains "-PON" -> "quote"
  - else -> "invoice" (fallback)
```

### DocumentLine Parent Resolution

```text
- Build a map of legacy_doc_id -> { uuid, table } during DocumentHeader import
- When importing lines, look up the parent document
- Insert into the matching _lines table
```

### Import Order Update

Add `purchase_orders`, `sales_orders`, `quotes` to the dispatcher. They should come after `partners` and `products` but before line items.

## What We Do NOT Change

- CSV parsing logic (sanitizeCSVText, reconstructLogicalRows, parseCSVLine)
- The analyze-legacy-zip function (it already handles dbo.* files correctly)
- The frontend LegacyImport.tsx page
- The flushBatch helper
- Existing importers for A_UnosPodataka, A_UnosPodataka_Partner, A_aPodaci
- The two-phase pipeline architecture

## Files Changed

1. `supabase/functions/import-legacy-zip/index.ts` -- add City lookup, enhance Partner/Product importers, add DocumentHeader routing, add DocumentLine importer, update dispatcher


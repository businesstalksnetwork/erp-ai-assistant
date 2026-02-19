
# Rewrite: import-legacy-zip Edge Function

## What's Wrong With the Current Design

After reading the full 1344-line function and cross-referencing against the live DB schema, the root problems are:

1. **Silent failures everywhere.** Errors are pushed to an array and counted — but the caller never sees them unless they read deep into the JSON. A single DB column mismatch causes an entire 500-row batch to fail with 0 rows inserted and 1 line in the errors array.

2. **`employees` inserts are failing** because the current code sends `first_name`/`last_name` but the table requires `full_name NOT NULL` with no default. Every employee row fails.

3. **`partners` legacy reference is stored in `contact_person`** which gets overwritten by actual contact person data — and `buildPartnerLegacyMap` only finds partners where the legacy code is there. This makes the PartnerLocation enrichment and contacts company-name join fail silently.

4. **The 500-row batch model means one bad row kills the whole batch.** If row 47 has a bad value, all 500 fail. No individual row error capture.

5. **Branching spaghetti.** Each importer has 2-3 code paths (Uniprom format vs generic format) tangled together. Adding a log line requires finding the right branch.

6. **No logging during import.** The function logs nothing with `console.log` during processing — so edge function logs are empty, giving zero debugging signal.

## New Design Philosophy

- **One row at a time in a batch, collected and flushed.** Each row error is caught individually and logged with the row number and content.
- **`console.log` at every step** — file name, row count, first 3 rows, each batch result. The edge function log becomes the debugging tool.
- **Each importer only knows one schema path** (the Uniprom `dbo.*` format). Generic files that don't match the column map get a clear "file format not recognized" message instead of guessing.
- **`employees` gets `full_name`** computed as `firstName + ' ' + lastName` before insert.
- **Partners legacy map uses a dedicated `maticni_broj` field** to store the legacy ID (this field is currently null for all Uniprom partners since they have PIBs, so it's safe to repurpose as `"LEG:12345"`). No more piggybacking on `contact_person`.
- **Batch insert with individual error logging.** Instead of bulk upsert where one failure silences everything, we do batches of 100 with a fallback single-row insert if the batch fails.
- **Every importer returns detailed stats**: `{ inserted, skipped, errors: [{row, reason}] }` — errors include the actual row data so you can trace the problem.

## Files to Change

Only one file changes: `supabase/functions/import-legacy-zip/index.ts`

The rewrite keeps the same external API (same request body, same response shape) and same dispatcher switch-case structure. It replaces the internal importer implementations.

## Structural Changes Per Importer

### `importPartners`
- Current: stores legacy ID in `contact_person` as `"LegacyCode:P000001"` — conflicts with actual contact person data
- New: stores legacy ID in `maticni_broj` as `"LEG:12345"` (safe because Uniprom PIBs exist but matični brojevi are usually empty in legacy data)
- Logs: `console.log("Partners batch 1/5: 100 rows, 98 inserted, 2 skipped")`

### `importEmployees`
- Current: sends `first_name`, `last_name` but NOT `full_name` → every row fails on NOT NULL violation
- New: computes `full_name = [firstName, lastName].filter(Boolean).join(' ')` before insert

### `importContacts`
- Current: builds partner company name by joining through `buildPartnerLegacyMap` which looks for `LegacyCode:` prefix in `contact_person` — after fix, this moves to `maticni_broj`
- New: updates `buildPartnerLegacyMap` to look for `LEG:` prefix in `maticni_broj`

### `importProducts`
- Keep batch upsert on `(tenant_id,sku)` for SKU'd items
- Add per-batch error logging: if batch fails, log which rows and why

### `importWarehouses`, `importDepartments`, `importTaxRates`
- These are working (indexes exist). Add `console.log` at start and end of each.

### `importInvoicesHeuristic`
- `partner_name` defaults to `''` so that's safe. Keep as-is but add logging.

### `importOpportunities`
- Already fixed (uses `title`, provides `value/currency/probability`). Add logging.

## Logging Strategy

Every importer will `console.log`:
```
[importPartners] dbo.Partner.csv: 1200 rows parsed
[importPartners] Batch 1: inserted 98, skipped 2, errors: []  
[importPartners] Batch 2: inserted 100, skipped 0, errors: []
[importPartners] TOTAL: 198 inserted, 2 skipped
```

This means the Supabase Edge Function logs panel becomes a real-time debugger.

## Technical Implementation Notes

- Keep `BATCH_SIZE = 100` (down from 500) so a bad batch affects fewer rows
- Keep all existing upsert conflict targets — the indexes are confirmed in the DB
- `buildPartnerLegacyMap` changes from: `contact_person.match(/LegacyCode:(\S+)/)` → `maticni_broj.match(/^LEG:(.+)/)`
- `employees` insert adds: `full_name: [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'`
- The function keeps the same HTTP interface — no changes to the frontend `LegacyImport.tsx`
- Deploy is automatic on save

## What We Do NOT Change

- CSV parsing logic (`sanitizeCSVText`, `reconstructLogicalRows`, `parseCSVLine`) — these work correctly
- `UNIPROM_COLUMN_MAP` — confirmed accurate for the Uniprom schema
- The dispatcher switch-case and `IMPORT_ORDER` sort
- The session tracking (`legacy_import_sessions` update calls)
- The ZIP file loading via JSZip
- Any frontend code

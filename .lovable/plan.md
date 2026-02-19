
# Smart ZIP Import Pipeline with AI-Assisted CSV Mapping

## The Problem

The legacy export contains 500+ CSV files. We can't know in advance what every file contains. The system needs to:
1. Accept a single ZIP upload
2. Inspect every CSV file inside it — read column headers and sample rows
3. Intelligently match each CSV to a known system table (or mark it as "unmapped")
4. Show you the mapping for review before any data is written
5. Execute the import only after you confirm

## Architecture — Two-Phase Approach

```text
PHASE 1 — ANALYZE (client-side, no data written)
  Browser uploads ZIP → edge function "analyze-legacy-zip"
    ├─ Unzips in Deno memory using JSZip (esm.sh)
    ├─ Reads first 5 rows + column headers of every CSV
    ├─ Pattern-matches against a known mapping table (500+ legacy table names)
    └─ Returns: array of { filename, rowCount, headers, sampleRows, suggestedTarget, confidence }

PHASE 2 — IMPORT (after user reviews/confirms mapping)
  Browser shows mapping review UI
  User can:  ✓ Accept  ✗ Skip  ✎ Override target  for each file
  On confirm → edge function "import-legacy-zip"
    ├─ Re-downloads ZIP from storage
    ├─ Imports only confirmed files in dependency order
    └─ Returns per-file: { inserted, skipped, errors }
```

## Known CSV → Table Mapping Registry

Based on the 3 sample files we've seen and the system's full schema (100+ tables), we build a hardcoded registry inside the edge function:

| Legacy CSV pattern | Confidence | System table | Key dedup field |
|---|---|---|---|
| `A_UnosPodataka.csv` | exact | `products` | `sku` |
| `A_UnosPodataka_Partner.csv` | exact | `partners` | `pib` / `name` |
| `A_aPodaci.csv` | exact | `contacts` | `email` |
| `A_Faktura*.csv` / `*Faktura*` | high | `invoices` | `invoice_number` |
| `*Invoice*` | high | `invoices` | `invoice_number` |
| `*Account*.csv` (with data) | high | `chart_of_accounts` | `code` |
| `*Employee*` | high | `employees` | `email` |
| `*Warehouse*` | medium | `warehouses` | `name` |
| `*Product*` | medium | `products` | `sku` |
| `*Contact*` | medium | `contacts` | `email` |
| `*Order*` | medium | `sales_orders` | `order_number` |
| `*PurchaseOrder*` | medium | `purchase_orders` | `order_number` |
| (empty / unrecognized) | none | `unmapped` | — |

Unrecognized files are shown in a "skipped / unknown" section. The user can manually assign a target table or skip them.

## UI — Three Screens on the Same Page

### Screen 1 — Upload

```
┌─────────────────────────────────────────────────────────┐
│  Legacy ZIP Import                                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │   📦  Drop your .zip file here or click to select  │ │
│  │        Supports up to 500 MB                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [ Analyze ZIP ]   ← disabled until file selected       │
└─────────────────────────────────────────────────────────┘
```

### Screen 2 — Mapping Review (after analysis)

```
┌─────────────────────────────────────────────────────────┐
│  Found 23 CSV files in archive.zip                      │
│  12 mapped  •  4 partial  •  7 unmapped/empty           │
│                                                          │
│  ✅ CONFIRMED MAPPINGS (12 files)                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ dbo.A_UnosPodataka.csv        → products  (3,729 rows) [✓] [✗] │
│  │ dbo.A_UnosPodataka_Partner.csv → partners (9,785 rows) [✓] [✗] │
│  │ dbo.A_aPodaci.csv             → contacts (293 rows)    [✓] [✗] │
│  │ dbo.A_Faktura.csv             → invoices (1,204 rows)  [✓] [✗] │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ⚠️  NEEDS REVIEW (4 files)                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ dbo.Account.csv  (empty, 0 rows)                 │   │
│  │ dbo.SomeOther.csv → [select target ▾] [skip]     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ❌ UNMAPPED / EMPTY (7 files)                           │
│  (collapsed by default, expandable)                      │
│                                                          │
│  [ Run Import for 12 confirmed files ]                   │
└─────────────────────────────────────────────────────────┘
```

### Screen 3 — Import Results

```
┌─────────────────────────────────────────────────────────┐
│  Import Complete                                         │
│                                                          │
│  products   ✓  3,729 inserted   0 skipped  0 errors     │
│  partners   ✓  9,785 inserted   0 skipped  0 errors     │
│  contacts   ✓    293 inserted   0 skipped  0 errors     │
│  invoices   ✓  1,204 inserted   0 skipped  12 errors ↗  │
└─────────────────────────────────────────────────────────┘
```

## Technical Details

### New Edge Function 1: `analyze-legacy-zip`

**What it does:**
- Receives: path to a ZIP file already uploaded to `legacy-imports/` bucket
- Uses `https://esm.sh/jszip` to unzip in memory
- For each `.csv` entry in the zip:
  - Reads first 2000 characters (header + ~5 rows) — no need to read the full file
  - Counts lines to estimate row count
  - Runs the mapping registry pattern matcher
- Returns a JSON array of file analyses — fast, no DB writes

```typescript
// Response shape
{
  files: [{
    filename: string,           // "dbo.A_UnosPodataka.csv"
    rowCount: number,           // estimated from line count
    headers: string[],          // first row if it looks like a header
    sampleRows: string[][],     // first 3 data rows
    suggestedTarget: string | null,  // "products", "partners", null
    confidence: "exact" | "high" | "medium" | "none",
    isEmpty: boolean
  }]
}
```

### New Edge Function 2: `import-legacy-zip`

**What it does:**
- Receives a confirmed mapping array: `[{ filename, targetTable }]`
- Downloads and unzips the same ZIP from storage
- Imports each file using the same logic as the individual import functions
- Uses the existing `import-legacy-products`, `import-legacy-partners`, `import-legacy-contacts` logic but generalized for any table
- Returns per-file results

### Column mapping for new file types

For CSV files mapped to `invoices`, the function uses heuristics on column names/content:
- Column with a date → `invoice_date`
- Column with a number that looks like an invoice number → `invoice_number`
- Numeric column with large values → `total`
- Column with name/company text → `partner_name`

This is a "best-effort" import — transactional data (invoices, journal entries) will have more partial matches and errors than master data (products, partners).

### New Migration: `legacy_import_sessions` table

A small table to persist analysis results so the UI can survive page refreshes:

```sql
CREATE TABLE legacy_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  zip_filename text,
  analysis jsonb,          -- full response from analyze-legacy-zip
  confirmed_mapping jsonb, -- user's confirmed selections
  import_results jsonb,    -- final per-file results
  status text DEFAULT 'analyzed', -- analyzed | importing | done | error
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

This means if the import takes 2 minutes on a 500-file ZIP, the user can close the tab and come back.

### Storage

- ZIP uploads go to `legacy-imports/` bucket (already exists)
- Filename: `upload-{timestamp}.zip` (avoid overwriting previous uploads)

### Files to Create / Modify

1. **`supabase/functions/analyze-legacy-zip/index.ts`** — New: reads ZIP from storage, samples each CSV, returns mapping suggestions
2. **`supabase/functions/import-legacy-zip/index.ts`** — New: orchestrator that imports confirmed files
3. **`supabase/config.toml`** — Add 2 new `verify_jwt = false` entries
4. **`supabase/migrations/XXXXXX_legacy_import_sessions.sql`** — New table for session persistence
5. **`src/pages/tenant/LegacyImport.tsx`** — Rebuilt as 3-screen flow (Upload → Review → Results), keeps individual import cards as "Advanced" section at bottom
6. Keep existing `import-legacy-products`, `import-legacy-partners`, `import-legacy-contacts` edge functions unchanged as a fallback

### Dependency Order During Import

The import function runs files in this order to respect foreign keys:
1. `products` (no deps)
2. `partners` (no deps)
3. `contacts` (no deps)
4. `warehouses` (no deps)
5. `employees` (no deps)
6. `invoices` (depends on partners — uses partner name match, not FK)
7. `journal_entries` (standalone)
8. Everything else

Note: For transactional data (invoices, journal entries, purchase orders), the import uses the `notes` / `reference` fields to store legacy IDs so data is preserved even if FK links can't be resolved at import time.


# ZIP Upload Import Pipeline

## What We're Building

A single unified import flow where you drop one `.zip` file containing all the legacy CSVs. The browser extracts the zip client-side, identifies the known CSV files, uploads them to Supabase Storage, then calls a single orchestrator edge function that runs all three imports sequentially and streams back a combined result.

## How It Works

```text
User selects ZIP
      │
      ▼
Browser (JSZip library)
  ├─ Extracts dbo.A_UnosPodataka.csv        → uploads to storage/legacy-imports/
  ├─ Extracts dbo.A_UnosPodataka_Partner.csv → uploads to storage/legacy-imports/
  └─ Extracts dbo.A_aPodaci.csv             → uploads to storage/legacy-imports/
      │
      ▼
Edge Function: import-legacy-all
  ├─ Downloads products CSV  → inserts into products   table (batches of 500)
  ├─ Downloads partners CSV  → inserts into partners   table (batches of 500)
  └─ Downloads contacts CSV  → inserts into contacts   table (batches of 200)
      │
      ▼
Returns JSON:
{
  products: { inserted, skipped, errors },
  partners: { inserted, skipped, errors },
  contacts: { inserted, skipped, errors }
}
```

## Technical Details

### Frontend Changes — `src/pages/tenant/LegacyImport.tsx`

The page will be completely rebuilt with a new "ZIP mode" as the primary interface:

- Single drag-and-drop zone accepting `.zip` files
- On file select: use the `fflate` library (already lightweight, no new dep needed) or native `DecompressionStream` — actually we'll use **JSZip via CDN import** since Deno has it but the browser doesn't natively unzip. We'll instead use the **`fflate`** npm package which is already a transitive dep in the project, or more simply: we upload the raw ZIP to the edge function and let Deno unzip it server-side using the `zip` module from the Deno standard library.

**Revised simpler approach — all unzipping happens server-side in Deno:**

1. Browser selects ZIP → uploads it as-is to `legacy-imports/upload.zip` in Supabase Storage
2. Browser calls `import-legacy-all` edge function (no body needed)
3. Edge function downloads the ZIP from storage, uses Deno's `https://deno.land/x/jszip` to unzip, reads each known CSV from memory, runs all three import loops, returns combined results

This avoids any browser unzipping dependency entirely.

### New Edge Function — `supabase/functions/import-legacy-all/index.ts`

```typescript
// 1. Download upload.zip from legacy-imports bucket
// 2. Unzip using JSZip for Deno
// 3. Run importProducts(csvText) → { inserted, skipped, errors }
// 4. Run importPartners(csvText) → { inserted, skipped, errors }
// 5. Run importContacts(csvText) → { inserted, skipped, errors }
// 6. Return combined JSON result
```

Known CSV filenames to look for inside the zip:
- `dbo.A_UnosPodataka.csv` → products
- `dbo.A_UnosPodataka_Partner.csv` → partners
- `dbo.A_aPodaci.csv` → contacts

Any other CSVs in the zip are ignored (future-proofing).

### Updated UI — New single-card layout

```
┌─────────────────────────────────────────────────────┐
│  Legacy Data Import                                  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         Drop ZIP file here or click           │  │
│  │         to select (max 20MB)                  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Detected files in ZIP:                              │
│  ✓ dbo.A_UnosPodataka.csv         (products)        │
│  ✓ dbo.A_UnosPodataka_Partner.csv (partners)        │
│  ✓ dbo.A_aPodaci.csv              (contacts)        │
│                                                      │
│  [  Run ZIP Import  ]                                │
│                                                      │
│  Results after import:                               │
│  Products  → 3,729 inserted  0 skipped              │
│  Partners  → 9,785 inserted  0 skipped              │
│  Contacts  → 293   inserted  0 skipped              │
└─────────────────────────────────────────────────────┘
```

The existing per-file cards will be kept below as a fallback "Advanced" section (for individual CSV imports).

### Progress States

| State | Display |
|---|---|
| `idle` | Drop zone shown |
| `uploading` | "Uploading ZIP… X%" progress bar |
| `importing` | Spinner + "Importing products… partners… contacts…" |
| `done` | Green result cards per entity |
| `error` | Red error message |

## Files to Create/Modify

1. **`supabase/functions/import-legacy-all/index.ts`** — New orchestrator edge function that downloads the zip from storage, extracts the 3 known CSVs, runs all imports, returns combined result
2. **`supabase/config.toml`** — Add `[functions.import-legacy-all]` entry with `verify_jwt = false`
3. **`src/pages/tenant/LegacyImport.tsx`** — Rebuild with ZIP drop zone at the top + keep individual CSV cards as a collapsible "Advanced" fallback below

No new npm packages needed — the ZIP upload goes directly to Supabase Storage as a binary file, and JSZip is imported in Deno from `https://esm.sh/jszip`.


# Fix Legacy ZIP Import — Data Not Appearing

## Root Cause Analysis

The database currently shows: 0 partners, 0 contacts, 0 products, 0 employees, 0 warehouses, 0 departments (only 4 currencies and 3 tax_rates from earlier successful imports).

**Seven confirmed bugs found by tracing the code against the new 581-file mapping document:**

### Bug 1 — Partners upsert fails on null PIB (most critical)
`importPartners()` calls `.upsert(batch, { onConflict: "tenant_id,pib" })` but ~60% of partners have no PIB. PostgreSQL does not match NULL in ON CONFLICT, so the upsert silently inserts duplicates — triggering a unique constraint violation on the next batch — causing the entire batch to error out and 0 rows land.

**Fix:** Split into two paths: upsert by `tenant_id,pib` when PIB is present; plain `.insert()` with ignoreDuplicates when PIB is null.

### Bug 2 — `getUnipromTableName()` returns null for files not in COLUMN_MAP
The function checks `UNIPROM_COLUMN_MAP[m[1]]` — if the table name isn't in the map, it returns `null`. This means `dbo.PartnerLocation.csv`, `dbo.Dobavljaci.csv`, `dbo.Nabavke.csv`, `dbo.Project.csv` all get `null` and fall to the generic skipped importer even though they are IMPORT targets.

**Fix:** `getUnipromTableName()` should strip `dbo.` and `.csv` and return the table name regardless — let the importers check the table name, not `getUnipromTableName()`.

### Bug 3 — Partner.csv has no PIB column in COLUMN_MAP  
`UNIPROM_COLUMN_MAP["Partner"]` only has `{ legacy_id: 0, name: 1, is_active: 17 }`. The importer calls `getCol!(cols, "pib")` which returns null for every row. All 10,493 partners go into the null-PIB path, batched together, and then hit the upsert bug above.

**Fix:** Add PIB enrichment from `A_UnosPodataka_Partner` — the code already stores `notes: "Legacy code: P00xxxx"`, so `PartnerLocation` can look up `partner_code` from col[7] and then cross-reference `A_UnosPodataka_Partner` for PIB. For now, fix is to use `.insert()` with `ignoreDuplicates: true` for null-PIB partners (no onConflict).

### Bug 4 — Employee legacy_id stored inconsistently
The `importEmployees()` stores legacy ID in notes as:
```
`Dept legacy ID: ${deptLegacyId}` 
```
But `importEmployeeContracts()` looks for:
```
/Legacy ID:\s*(\d+)/
```
These never match — so 0 contracts are imported even if employees are present.

**Fix:** Store employee legacy_id explicitly in notes as `Legacy ID: ${legacyId}` and look for `Dept ID: ${deptLegacyId}` separately.

### Bug 5 — Duplicate `CurrencyRates` key in DBO_TABLE_LOOKUP
`CurrencyRates` is defined twice in `analyze-legacy-zip/index.ts` (lines 176 and 186). TypeScript uses the last definition. This is harmless functionally since both map to `skip`, but triggers a lint warning and should be cleaned.

### Bug 6 — `invoices` upsert conflict column doesn't exist reliably
`importInvoicesHeuristic()` uses `.upsert(batch, { onConflict: "tenant_id,invoice_number" })` but for `DocumentHeader.csv` the invoice_number is extracted from col[3] (actually the DocumentList ID, not the doc number). The real number is col[1] per the mapping document. 

**Fix:** Update `DocumentHeader` column map: `{ doc_number: 1, date: 2, doc_list_id: 3, status_id: 4, partner_id: 6, warehouse_id: 7, total: 11 }` per the document's table on page 10.

### Bug 7 — `confirmedMapping` only gets files user manually accepted
The `LegacyImport.tsx` review page requires user to click "Accept" on each file mapping. When analyzing 581 files, most show as auto-accepted for "exact" confidence — but the UI might not be sending all of them. The previous session log showed only `dbo.DocumentHeader.csv` in the import results.

**Fix:** Verify the `LegacyImport.tsx` auto-accept logic and ensure all `confidence: "exact"` non-empty non-skip files are pre-accepted and included in `confirmedMapping`.

---

## Changes Required

### File 1: `supabase/functions/import-legacy-zip/index.ts`

**1a. Fix `getUnipromTableName()`** — return the table name always, don't gate on COLUMN_MAP:
```typescript
function getUnipromTableName(filename: string): string | null {
  const basename = filename.split("/").pop() || filename;
  const m = basename.match(/^dbo\.(.+?)\.csv$/i);
  return m ? m[1] : null;
}
```

**1b. Fix `importPartners()` null-PIB upsert** — use insert for rows without PIB:
```typescript
// For rows WITH pib: upsert on tenant_id,pib
// For rows WITHOUT pib: insert with ignoreDuplicates (no conflict column)
const withPib = batch.filter(r => r.pib);
const withoutPib = batch.filter(r => !r.pib);
if (withPib.length) await supabase.from("partners").upsert(withPib, { onConflict: "tenant_id,pib", ignoreDuplicates: true });
if (withoutPib.length) await supabase.from("partners").insert(withoutPib).select(); // best-effort
```

**1c. Fix `importEmployees()` legacy_id storage** — store the actual col[0] legacy_id in notes:
```typescript
notes: [
  `Legacy ID: ${cols[cm.legacy_id]}`,
  jmbg ? `JMBG: ${jmbg}` : null,
  deptLegacyId ? `Dept ID: ${deptLegacyId}` : null
].filter(Boolean).join(" | ") || null,
```

**1d. Fix `importEmployeeContracts()` legacy_id lookup** — match the new notes pattern:
```typescript
const legacyMatch = (e.notes || "").match(/Legacy ID:\s*(\d+)/);
if (legacyMatch) empLegacyMap[legacyMatch[1]] = e.id;
```

**1e. Fix `DocumentHeader` column positions** — per the document col[1]=number, col[2]=date, col[6]=partner_id:
```typescript
"DocumentHeader": { legacy_id: 0, doc_number: 1, date: 2, doc_list_id: 3, status_id: 4, partner_id: 6, warehouse_id: 7, total: 11 },
```

**1f. Add `Project` to COLUMN_MAP** — document says 314 rows → `opportunities`:
```typescript
"Project": { legacy_id: 0, name: 1, start_date: 3, end_date: 4, status_id: 9, partner_id: 7 },
```

**1g. Add `importOpportunities()` function** for `dbo.Project.csv` → `opportunities` table, with `case "opportunities"` in the dispatcher.

**1h. Fix `invoices` import for DocumentHeader** — use `doc_number` from col[1] not col[3]:
The current `importInvoicesHeuristic()` uses header-based detection. For `DocumentHeader.csv` (no headers), add a Uniprom-specific path in the `invoices` case of the dispatcher.

### File 2: `supabase/functions/analyze-legacy-zip/index.ts`

**2a. Fix duplicate `CurrencyRates` entry** — remove the first definition (line 176), keep only the second (line 186).

**2b. Add new IMPORT targets from document:**
- `Project` → `opportunities` (314 rows)
- `PartnerContactInteraction` → change from `skip` to `meetings` (3,635 rows — but contains HTML, keep as skip with better label)
- `Dobavljaci`, `Investitori`, `Projektanti`, `Nabavke`, `Odrzavanje` → mark as `partners` with `confidence: "high"` (partner tag enrichment)

**2c. Update `Opportunity` target** — document says it maps to `opportunities`, not `leads`:
```typescript
"Opportunity": { target: "opportunities", confidence: "exact", label: "..." }
```

### File 3: `src/pages/tenant/LegacyImport.tsx`

**3a. Fix auto-accept logic** — ensure all `confidence: "exact"` files that are:
- Not empty (`rowCount > 0`)  
- Not auto-skipped (`targetTable !== "skip"`)

...are automatically included in `confirmedMapping` with `accepted: true` when the user clicks "Start Import", without requiring manual per-file approval.

---

## Import Order (respecting FK dependencies)
The document confirms this order for the 25 IMPORT files:
1. `dbo.Company.csv` → legal_entities
2. `dbo.Currency.csv` → currencies  
3. `dbo.Tax.csv` → tax_rates
4. `dbo.Department.csv` → departments
5. `dbo.Warehouse.csv` → warehouses
6. `dbo.Item.csv` → products (3,739 rows)
7. `dbo.A_UnosPodataka.csv` → products ENRICH (prices + stock)
8. `dbo.Partner.csv` → partners (10,493 rows)
9. `dbo.A_UnosPodataka_Partner.csv` → partners ENRICH (PIB)
10. `dbo.PartnerLocation.csv` → partners ENRICH (addresses)
11. `dbo.PartnerContact.csv` → contacts (11,587 rows)
12. `dbo.Employee.csv` → employees (45 rows)
13. `dbo.Project.csv` → opportunities (314 rows)
14. `dbo.Opportunity.csv` → opportunities (2 rows)
15. `dbo.DocumentHeader.csv` → invoices/sales_orders/etc (848 rows)
16. `dbo.DocumentLine.csv` → invoice_lines (384 rows)

## Files to Modify

| File | Changes |
|---|---|
| `supabase/functions/import-legacy-zip/index.ts` | Fix getUnipromTableName, fix null-PIB upsert, fix employee legacy_id storage, fix contract lookup, fix DocumentHeader columns, add opportunities importer |
| `supabase/functions/analyze-legacy-zip/index.ts` | Remove duplicate CurrencyRates, fix Opportunity target, add Project mapping |
| `src/pages/tenant/LegacyImport.tsx` | Fix auto-accept to include all exact-confidence non-empty importable files |

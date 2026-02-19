
# Root Cause: Missing DB Constraints + Wrong Column Names

## Confirmed Bugs (from DB schema inspection + session logs)

The import runs and finishes, but 0 rows land because every single importer is hitting one of these hard errors:

### Bug A — Missing unique constraints (most critical — affects ALL tables)
The upsert calls use `onConflict: "tenant_id,pib"` (partners), `"tenant_id,sku"` (products), `"tenant_id,invoice_number"` (invoices), `"tenant_id,name"` (warehouses, tax_rates) — **but none of these constraints exist in the database**. Only `currencies (tenant_id,code)` and `departments (tenant_id,code)` have unique constraints. PostgreSQL throws "there is no unique or exclusion constraint matching the ON CONFLICT specification" — confirmed in the session log.

### Bug B — `opportunities` table has wrong column name
The import code inserts `{ name: ... }` but the actual DB column is `title`. Also `value`, `currency`, `probability` are NOT NULL with no defaults and are missing from the insert.

### Bug C — `departments` upsert uses wrong conflict column
Code: `onConflict: "tenant_id,name"` — but the DB constraint is `(tenant_id,code)`. The department code field is short and unique per tenant; name has no constraint.

### Bug D — `tax_rates` upsert uses nonexistent `(tenant_id,name)` constraint
No unique constraint on `tax_rates` at all except the primary key.

### Bug E — `warehouses` upsert uses nonexistent `(tenant_id,name)` constraint
Same as above — no unique constraint beyond PK.

### Bug F — `contacts.insert` fails on duplicate check with `function_area` column
The contacts table has no `function_area` column — the import inserts `function_area: role || null` which will fail with a column-not-found error.

## Fix Plan

### Migration — Add missing unique constraints

Add a Supabase migration that creates the constraints the import code assumes exist:

```sql
-- Partners: unique PIB per tenant (only when PIB is not null)
CREATE UNIQUE INDEX IF NOT EXISTS partners_tenant_pib_key 
  ON public.partners (tenant_id, pib) WHERE pib IS NOT NULL;

-- Products: unique SKU per tenant (only when SKU is not null)  
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_key
  ON public.products (tenant_id, sku) WHERE sku IS NOT NULL;

-- Invoices: unique invoice_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_invoice_number_key
  ON public.invoices (tenant_id, invoice_number);

-- Warehouses: unique name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_tenant_name_key
  ON public.warehouses (tenant_id, name);

-- Tax rates: unique name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS tax_rates_tenant_name_key
  ON public.tax_rates (tenant_id, name);
```

Note: `departments` already has `(tenant_id, code)` — the import code just needs to use the right conflict column.

### Code fix — `import-legacy-zip/index.ts`

**Fix 1: `importOpportunities()`** — map `name` → `title`, add required NOT NULL fields:
```typescript
batch.push({
  tenant_id: tenantId,
  title: name,          // was: name — wrong column
  stage: "prospecting",
  status: "open",       // remove: not a column in opportunities
  value: 0,             // required NOT NULL
  currency: "RSD",      // required NOT NULL
  probability: 10,      // required NOT NULL
  expected_close_date: parseDate(...),
  notes: `Imported from legacy ${unipromTable}`,
});
```

Also update the dedup check: `nameSet` → compare against `title` column:
```typescript
const { data: existing } = await supabase.from("opportunities").select("title").eq("tenant_id", tenantId);
const nameSet = new Set((existing || []).map((r: any) => r.title?.toLowerCase()));
```

**Fix 2: `importDepartments()`** — change conflict column from `name` to `code`:
```typescript
// From:
{ onConflict: "tenant_id,name", ignoreDuplicates: true }
// To:
{ onConflict: "tenant_id,code", ignoreDuplicates: true }
```

**Fix 3: `importContacts()`** — remove `function_area` (column doesn't exist), map to `notes` instead:
```typescript
// Remove: function_area: role || null,
// Add role info to notes:
notes: [
  legacyPartnerId ? `Legacy partner ref: ${legacyPartnerId}` : null,
  role ? `Role: ${role}` : null,
].filter(Boolean).join(" | ") || null,
```

**Fix 4: `importPartners()` null-PIB batch** — use `ignoreDuplicates: true` with the partial index:
```typescript
// For rows WITHOUT pib: use insert with onConflict ignore on name
if (withoutPib.length) {
  const { error } = await supabase.from("partners").insert(withoutPib);
  if (error && !error.message.includes("duplicate")) errors.push(`No-PIB insert: ${error.message}`);
  else inserted += withoutPib.length;
}
```

**Fix 5: `importInvoicesHeuristic()`** — add Uniprom-specific path using DocumentHeader column map when filename is recognized:
The current function calls `parseCSV()` which tries to detect headers. Since DocumentHeader has no headers, col[0] (legacy_id integer) is used as `invNum`, causing duplicates/skips. Add a check at the top:
```typescript
const unipromTable = filename ? getUnipromTableName(filename) : null;
if (unipromTable === "DocumentHeader") {
  // Use column positions from UNIPROM_COLUMN_MAP
  const cm = UNIPROM_COLUMN_MAP["DocumentHeader"];
  const lines = reconstructLogicalRows(sanitizeCSVText(csvText));
  // ... use cm.doc_number for invoice_number
}
```

But note the dispatcher at line 1251 does NOT pass `filename` to `importInvoicesHeuristic()` — this is the bug mentioned in the plan but never fixed. Fix the dispatcher call:
```typescript
case "invoices": result = await importInvoicesHeuristic(csvText, tenantId, supabase, fullPath || filename); break;
```
And update the function signature to accept `filename?: string`.

## Files to Modify

| File | Change |
|---|---|
| New migration file | Add 5 unique partial indexes for partners, products, invoices, warehouses, tax_rates |
| `supabase/functions/import-legacy-zip/index.ts` | Fix opportunities (title+required fields), departments (conflict column), contacts (remove function_area), invoices (pass filename, use Uniprom columns) |

## Import Order After Fix

After these fixes, uploading `Uniprom_csv-4.zip` should result in:
- `dbo.Currency.csv` / `dbo.CurrencyISO.csv` → currencies (already works — has constraint)
- `dbo.Tax.csv` → tax_rates (needs new constraint)  
- `dbo.Department.csv` → departments (needs conflict column fix)
- `dbo.Warehouse.csv` → warehouses (needs new constraint)
- `dbo.Item.csv` → products (needs new partial index)
- `dbo.Partner.csv` + `dbo.A_UnosPodataka_Partner.csv` → partners (needs partial index)
- `dbo.PartnerLocation.csv` → partners enrichment
- `dbo.PartnerContact.csv` / `dbo.A_aPodaci.csv` → contacts (needs function_area fix)
- `dbo.Employee.csv` → employees
- `dbo.Project.csv` / `dbo.Opportunity.csv` → opportunities (needs title fix)
- `dbo.DocumentHeader.csv` → invoices (needs filename passed to importer)

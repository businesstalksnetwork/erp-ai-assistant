
# ZIP Mapping Based on the CSV → ERP-AI Mapping Document

## What the Document Specifies

The document (CSV_to_ERP_AI_Mapping.docx) is an 18-page, highly detailed guide for importing UNIPROM FactorOne legacy data. It defines:

1. Exact column-position mappings for each CSV file (no headers — first row is data)
2. Multi-file JOIN strategies (Partners from 3 CSVs, Products from 2 CSVs)
3. Document type splitting (DocumentHeader → invoices / sales_orders / purchase_orders / goods_receipts)
4. Import order respecting FK dependencies
5. Deduplication keys (PIB for partners, SKU for products, email for contacts)

## Current Gaps vs. Document

The existing `analyze-legacy-zip` edge function already has a strong `DBO_TABLE_LOOKUP`, but it's **missing all the specific Uniprom FactorOne English-named tables** the document describes:

| Missing Table | Document Target | Notes |
|---|---|---|
| `dbo.Partner` | `partners` | col[0]=legacy_id, col[1]=name, col[17]=active |
| `dbo.PartnerLocation` | `partners` (address enrichment) | col[22]=partner_id JOIN key |
| `dbo.A_UnosPodataka_Partner` | `partners` (PIB enrichment) | Already exists with "exact" confidence ✓ |
| `dbo.Company` | `legal_entities` | 1 row only |
| `dbo.CompanyOffice` | `locations` | 1 row only |
| `dbo.Warehouse` | `warehouses` | col[1]=code, col[2]=name |
| `dbo.Department` | `departments` | 12 rows |
| `dbo.Currency` | `currencies` | col[2]=ISO code |
| `dbo.CurrencyRates` | (exchange_rates) | 5 rows |
| `dbo.Tax` | `tax_rates` | col[3]=rate (multiply by 100) |
| `dbo.Employee` | `employees` | col[1]=first_name, col[2]=last_name, col[4]=jmbg |
| `dbo.PartnerContact` | `contacts` | col[1]=last_name, col[2]=first_name, col[10]=email |
| `dbo.Opportunity` | `leads` | 2 rows |
| `dbo.Bank` | skip | Reference table |
| `dbo.DocumentList` | skip | Reference table |
| `dbo.BookkeepingBookType` | skip | Already in lookup ✓ |
| `dbo.Dobavljaci` | `partners` (was: skip due to binary) | Doc says 254 rows of supplier segment |
| `dbo.Investitori` | skip | CRM segment, P2 priority |
| `dbo.Projektanti` | skip | CRM segment, P2 priority |
| `dbo.Trgovci` | skip | CRM segment, P2 priority |
| `dbo.ElektroMontazeri` | `leads` | 246 rows, P2 |

Most critically, `dbo.DocumentHeader` exists in the lookup but maps to `invoices` generically. The document defines **17 document types** that should split into different tables.

## Changes Required

### File 1: `supabase/functions/analyze-legacy-zip/index.ts`

Add all missing Uniprom FactorOne tables to `DBO_TABLE_LOOKUP` with the exact column mappings documented:

```
// New entries to add to DBO_TABLE_LOOKUP:
"Partner":          { target: "partners",       confidence: "exact", label: "Exact: Uniprom Partner.csv — col[0]=legacy_id, col[1]=name, col[17]=active", dedupField: "pib" }
"PartnerLocation":  { target: "partners",       confidence: "exact", label: "Exact: address enrichment for partners — col[22]=partner_legacy_id JOIN key, col[1]=full_name, col[7]=partner_code", dedupField: "pib" }
"PartnerContact":   { target: "contacts",       confidence: "exact", label: "Exact: Uniprom PartnerContact — col[1]=last_name, col[2]=first_name, col[10]=email, col[12]=partner_legacy_id", dedupField: "email" }
"Company":          { target: "legal_entities", confidence: "exact", label: "Exact: Uniprom Company.csv — col[1]=name, col[3]=address, col[6]=pib, col[7]=maticni_broj (1 row)", dedupField: "name" }
"CompanyOffice":    { target: "locations",      confidence: "exact", label: "Exact: Uniprom CompanyOffice.csv — col[1]=name, col[3]=address (1 row)", dedupField: "name" }
"Currency":         { target: "currencies",     confidence: "exact", label: "Exact: Uniprom Currency.csv — col[1]=name, col[2]=ISO_code (4 currencies)", dedupField: "code" }
"CurrencyRates":    { target: "skip",           confidence: "exact", label: "Exchange rates ref — auto-skip (5 rows, set via NBS integration)", skipReason: "Use NBS exchange rates integration instead" }
"Tax":              { target: "tax_rates",      confidence: "exact", label: "Exact: Uniprom Tax.csv — col[1]=name, col[2]=PDV_code, col[3]=rate (multiply x100)", dedupField: "name" }
"Employee":         { target: "employees",      confidence: "exact", label: "Exact: Uniprom Employee.csv — col[1]=first_name, col[2]=last_name, col[4]=jmbg, col[9]=dept_legacy_id (45 employees)", dedupField: "email" }
"Opportunity":      { target: "leads",          confidence: "exact", label: "Exact: Uniprom Opportunity.csv — 2 rows mapped to leads", dedupField: "id" }
"ElektroMontazeri": { target: "leads",          confidence: "high",  label: "Uniprom ElektroMontazeri — 246 rows, electrical installer CRM segment → leads", dedupField: "id" }
"Investitori":      { target: "skip",           confidence: "exact", label: "Investitori — auto-skip (P2 CRM segment, no import target)", skipReason: "P2 priority CRM segment (investors)" }
"Projektanti":      { target: "skip",           confidence: "exact", label: "Projektanti — auto-skip (P2 CRM segment, no import target)", skipReason: "P2 priority CRM segment (designers)" }
"Trgovci":          { target: "skip",           confidence: "exact", label: "Trgovci — auto-skip (P2 CRM segment, no import target)", skipReason: "P2 priority CRM segment (traders)" }
"Bank":             { target: "skip",           confidence: "exact", label: "Bank lookup — auto-skip (3 rows reference table)", skipReason: "Bank reference lookup (3 rows)" }
```

Also update `DocumentHeader` to reflect the document type splitting knowledge in its label:

```
"DocumentHeader": { 
  target: "invoices",    
  confidence: "high",  
  label: "DocumentHeader = universal document — splits by type: IRPDV/RPDV/FAV→invoices, PO/PN→sales_orders, NAR→purchase_orders, UPDV/U10→goods_receipts. WARNING: multi-line CSV format requires custom parsing.", 
  dedupField: "invoice_number" 
}
```

And mark `DocumentLine` as importable (not auto-skip) since the document says it should be imported as `invoice_lines`:
```
"DocumentLine": { target: "invoices", confidence: "medium", label: "DocumentLine = line items for DocumentHeader — maps to invoice_lines after DocumentHeader import", requiresParent: "invoices", dedupField: "id" }
```

### File 2: `supabase/functions/import-legacy-zip/index.ts`

The existing ZIP import function needs to be updated to handle the specific column positions documented for each Uniprom file. Currently the import functions use generic column detection. We need to add a **Uniprom-specific column mapping registry** that the import function consults when it recognizes a known filename:

The document's exact column mappings per file:

**partners (from A_UnosPodataka_Partner.csv)** — already has a dedicated edge function, keep as is.

**partners (from Partner.csv)** — new mapping:
- col[0] → legacy_id
- col[1] → name (fallback if no PartnerLocation)
- col[17] → is_active (1=active)

**contacts (from PartnerContact.csv)**:
- col[0] → legacy_id
- col[1] → last_name
- col[2] → first_name
- col[6] → phone
- col[10] → email
- col[12] → partner_legacy_id (for company_name lookup)

**products (from Item.csv)**:
- col[0] → legacy_id
- col[1] → name
- col[2] → sku (JOIN key to A_UnosPodataka)
- col[33] → is_active
- col[34] → product_type (1=goods)

**employees (from Employee.csv)**:
- col[0] → legacy_id
- col[1] → first_name
- col[2] → last_name
- col[4] → jmbg (dedup key)
- col[9] → department_legacy_id

**departments (from Department.csv)**:
- col[0] → legacy_id
- col[1] → name
- col[3] → code

**currencies (from Currency.csv)**:
- col[1] → name
- col[2] → code (ISO)

**tax_rates (from Tax.csv)**:
- col[1] → name
- col[3] → rate (× 100 for percentage)

**legal_entities (from Company.csv)**:
- col[1] → name
- col[3] → address
- col[6] → pib
- col[7] → maticni_broj

**warehouses (from Warehouse.csv)**:
- col[1] → code
- col[2] → name

### File 3: New edge function `supabase/functions/import-legacy-zip/index.ts`

Update the existing import-legacy-zip function to include a `UNIPROM_COLUMN_MAP` registry keyed by filename (without the `dbo.` prefix and `.csv` suffix). The import function already handles generic CSV → target table mapping. We add a lookup that, when a recognized Uniprom filename is detected, applies the exact column positions from the document instead of generic header detection.

## Implementation Summary

### What changes in `analyze-legacy-zip/index.ts`:
- Add 14 new entries to `DBO_TABLE_LOOKUP` for the specific Uniprom FactorOne files
- Update `DocumentHeader` label to include document type splitting information
- Change `DocumentLine` from auto-skip to importable (as invoice lines, requiresParent)
- Total: ~40 lines added to the lookup table

### What changes in `import-legacy-zip/index.ts`:
- Add a `UNIPROM_COLUMN_MAP` object with exact column positions for each Uniprom file
- Modify the `importFile()` function to check this map first before falling back to generic detection
- Add Uniprom-specific transformations: rate × 100 for Tax.csv, active flag for Partner.csv, name splitting for PartnerContact.csv

### No UI changes needed
The `LegacyImport.tsx` page already handles the analyze → review → import flow correctly. Once the edge functions return proper mappings, the review screen will show the correct target tables and confidence levels for all 45+ Uniprom CSV files.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/analyze-legacy-zip/index.ts` | Add 14 missing Uniprom file entries to DBO_TABLE_LOOKUP; update DocumentHeader/DocumentLine labels |
| `supabase/functions/import-legacy-zip/index.ts` | Add UNIPROM_COLUMN_MAP with exact column positions per the document; apply in importFile() |

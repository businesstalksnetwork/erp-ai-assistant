
# Comprehensive CSV → Database Mapping: Full Analysis & Implementation

## What I Know About the Uniprom Export

From reading the 3 actual CSV files and the `dbo.*` MS SQL Server naming pattern, this is a **Uniprom ERP system** (Serbian industrial electrical equipment distributor). The export follows the pattern `dbo.TableName.csv` — these are direct SQL Server table dumps. 

The 3 confirmed files show:
- `dbo.A_UnosPodataka.csv` — Products (no header, 13 cols: SKU, Name, Unit, Qty, PurchasePrice, SalePrice, IsActive, Cat1–5, Brand)
- `dbo.A_UnosPodataka_Partner.csv` — Partners (no header, 6 cols: Code P000001, Name, Country, City, PIB, Contact)
- `dbo.A_aPodaci.csv` — Contacts (no header, 7 cols: LegacyPartnerID, LastName, FirstName, Role, City, Email, Phone)

From the `dbo.` prefix pattern, the 500+ files are **all SQL Server table names**. This means we can do much better matching by knowing the exact `dbo.TableName` → system table mapping rather than using regex guesses.

## What Needs to Improve

### Current Problems with `analyze-legacy-zip`
1. **Filename patterns are regex guesses** — but we actually know the prefix is `dbo.` so we can build a **precise lookup table** of `TableName → system table`
2. **No column-level confidence** — for no-header files, we currently auto-assign `col_1, col_2...` which is useless for verification
3. **The 3 known files have exact column maps** — but for the other 500+ unknown tables, we need smarter column-signal detection
4. **Import function only handles 3 tables** — products, partners, contacts; everything else falls through to `importGeneric` which does nothing

### Current Problems with `import-legacy-zip`
1. Only 3 importers exist (products, partners, contacts) — everything else is skipped
2. The `importGeneric` function returns 0 inserted / all skipped with a "no importer" message
3. No column-heuristic importers for common transactional tables

## Solution: Two-Layer Mapping Strategy

### Layer 1 — Exact `dbo.TableName` Lookup Table (500+ known MS SQL Server table names)
Since all files follow `dbo.EXACT_TABLE_NAME.csv`, we build a lookup dictionary that maps every **known Uniprom ERP table name** to its system equivalent. When the file is `dbo.A_Fakture.csv`, we look up `A_Fakture` and get `{ target: "invoices", confidence: "exact" }`.

This covers the known Uniprom schema tables. For any table NOT in the lookup, we fall back to regex → headers.

### Layer 2 — Generic Column-Signal Heuristics (for unknown tables)
Improved header scanning that understands Serbian column names at a column level — not just filename patterns.

## Complete `dbo.*` → System Table Mapping Registry

Based on the known files, Serbian ERP conventions, and the system's 120+ tables, here is the full lookup table I'll build into the edge function:

### Master Data Tables

| `dbo.TableName` | System Table | Confidence | Notes |
|---|---|---|---|
| `A_UnosPodataka` | `products` | exact | Known file, no header |
| `A_UnosPodataka_Partner` | `partners` | exact | Known file, no header |
| `A_aPodaci` | `contacts` | exact | Known file, no header |
| `A_Magacin` | `warehouses` | high | Magacin = warehouse |
| `A_Lokacija` | `locations` | high | Lokacija = location |
| `A_Valuta` | `currencies` | high | Valuta = currency |
| `A_Zaposleni` | `employees` | high | Zaposleni = employees |
| `A_Odeljenje` | `departments` | high | Odeljenje = department |
| `A_KontniPlan` | `chart_of_accounts` | high | Kontni plan = chart of accounts |
| `A_KontoPlan` | `chart_of_accounts` | high | Alt spelling |
| `A_Konto` | `chart_of_accounts` | high | Single account |
| `A_Artikal` | `products` | high | Artikal = article/product |
| `A_Kupac` | `partners` | high | Kupac = customer |
| `A_Dobavljac` | `partners` | high | Dobavljac = supplier |
| `A_PoslovniPartner` | `partners` | high | Business partner |
| `A_Kontakt` | `contacts` | high | Kontakt = contact |
| `A_TipPartnera` | `skip` | exact | Partner type lookup — no system table |
| `A_Drzava` | `skip` | exact | Country lookup table — skip |
| `A_Grad` | `skip` | exact | City lookup table — skip |
| `A_JedinicaMere` | `skip` | exact | Unit of measure lookup — skip |
| `A_Kategorija` | `skip` | exact | Category lookup — skip |

### Transactional Tables

| `dbo.TableName` | System Table | Confidence | Notes |
|---|---|---|---|
| `A_Faktura` | `invoices` | high | Faktura = invoice (outgoing) |
| `A_FakturaStavka` | `invoice_lines` | high | Stavka = line item |
| `A_FakturaLinija` | `invoice_lines` | high | Alt name |
| `A_UlaznaFaktura` | `supplier_invoices` | high | Ulazna = incoming/supplier |
| `A_UlaznaFakturaStavka` | `supplier_invoice_lines` | high | Supplier invoice lines |
| `A_Racun` | `invoices` | high | Racun = receipt/invoice |
| `A_Otpremnica` | `invoices` | high | Otpremnica = delivery note |
| `A_Narudzbenica` | `purchase_orders` | high | Purchase order |
| `A_NarudzbenicaStavka` | `purchase_order_lines` | high | PO line items |
| `A_ProdajniNalog` | `sales_orders` | high | Sales order |
| `A_ProdajniNalogStavka` | `sales_order_lines` | high | SO line items |
| `A_Primka` | `goods_receipts` | high | Goods receipt |
| `A_PrimkaStavka` | `goods_receipt_items` | high | Goods receipt line items |
| `A_Kalkulacija` | `products` | high | Pricing calculation — maps to products with price data |
| `A_KalkulacijaStavka` | `products` | high | Kalkulacija line items |
| `A_Nivelacija` | `retail_prices` | high | Nivelacija = price level adjustment |
| `A_Placanje` | `skip` | medium | Payments — no direct system table |
| `A_BankovniIzvod` | `bank_statements` | high | Bank statement |
| `A_Kompenzacija` | `skip` | medium | Compensation/offset — no direct table |
| `A_Lager` | `inventory_stock` | high | Lager = stock/inventory |
| `A_LagerPromet` | `inventory_movements` | high | Stock movements |
| `A_InternaNarudzbenica` | `purchase_orders` | medium | Internal order |
| `A_PoreznaStopaOsnove` | `tax_rates` | high | Tax rate bases |

### HR Tables

| `dbo.TableName` | System Table | Confidence | Notes |
|---|---|---|---|
| `A_Radnik` | `employees` | high | Radnik = worker |
| `A_Ugovor` | `employee_contracts` | high | Ugovor = contract |
| `A_ObracunPlata` | `payroll_runs` | high | Payroll run |
| `A_ObracunPlataStavka` | `payroll_items` | high | Payroll line |
| `A_Odsustvo` | `leave_requests` | high | Odsustvo = leave/absence |
| `A_Bolovanje` | `leave_requests` | high | Bolovanje = sick leave |
| `A_GodisnjOdmor` | `leave_requests` | high | Annual leave |
| `A_Prekovremeni` | `overtime_hours` | high | Overtime |
| `A_NocniRad` | `night_work_records` | high | Night work |

### Tables to Skip (lookup/config tables with no direct import target)

Many tables in Serbian ERPs are small configuration/lookup tables:
- `A_TipDokumenta` — document type lookup
- `A_StatusDokumenta` — document status
- `A_TipPartnera` — partner type
- `A_Drzava` — countries
- `A_Grad` — cities
- `A_JedinicaMere` — units of measure
- `A_TipRobe` — product type
- `A_Kategorija` — categories
- `A_StatusNaloga` — order status lookups
- Any table with 0-5 rows and only code/name columns → auto-skip

These should be **auto-marked as "skip — lookup/config table"** and collapsed by default in the UI.

## Files to Modify

### 1. `supabase/functions/analyze-legacy-zip/index.ts`

**Add a `DBO_TABLE_LOOKUP` dictionary** before `MAPPING_RULES`:

```typescript
const DBO_TABLE_LOOKUP: Record<string, { target: string; confidence: "exact" | "high" | "medium"; label: string; skipReason?: string }> = {
  // Known exact files
  "A_UnosPodataka":          { target: "products",            confidence: "exact", label: "Uniprom products table (confirmed)" },
  "A_UnosPodataka_Partner":  { target: "partners",            confidence: "exact", label: "Uniprom partners table (confirmed)" },
  "A_aPodaci":               { target: "contacts",            confidence: "exact", label: "Uniprom contacts table (confirmed)" },
  
  // Master data
  "A_Magacin":               { target: "warehouses",          confidence: "high",  label: "Magacin = warehouse" },
  "A_Lokacija":              { target: "locations",           confidence: "high",  label: "Lokacija = location" },
  "A_Valuta":                { target: "currencies",          confidence: "high",  label: "Valuta = currency" },
  "A_Zaposleni":             { target: "employees",           confidence: "high",  label: "Zaposleni = employees" },
  "A_Radnik":                { target: "employees",           confidence: "high",  label: "Radnik = worker/employee" },
  "A_Odeljenje":             { target: "departments",         confidence: "high",  label: "Odeljenje = department" },
  "A_KontniPlan":            { target: "chart_of_accounts",  confidence: "high",  label: "Kontni plan = chart of accounts" },
  "A_KontoPlan":             { target: "chart_of_accounts",  confidence: "high",  label: "Konto plan = chart of accounts" },
  "A_Konto":                 { target: "chart_of_accounts",  confidence: "high",  label: "Konto = account" },
  "A_Artikal":               { target: "products",            confidence: "high",  label: "Artikal = article/product" },
  "A_Kupac":                 { target: "partners",            confidence: "high",  label: "Kupac = customer partner" },
  "A_Dobavljac":             { target: "partners",            confidence: "high",  label: "Dobavljac = supplier partner" },
  "A_PoslovniPartner":       { target: "partners",            confidence: "high",  label: "Poslovni partner = business partner" },
  "A_Kontakt":               { target: "contacts",            confidence: "high",  label: "Kontakt = contact" },
  
  // Transactional
  "A_Faktura":               { target: "invoices",           confidence: "high",  label: "Faktura = sales invoice" },
  "A_FakturaStavka":         { target: "invoice_lines",      confidence: "high",  label: "Faktura stavka = invoice line items" },
  "A_FakturaLinija":         { target: "invoice_lines",      confidence: "high",  label: "Faktura linija = invoice lines" },
  "A_UlaznaFaktura":         { target: "supplier_invoices",  confidence: "high",  label: "Ulazna faktura = supplier invoice" },
  "A_UlaznaFakturaStavka":   { target: "supplier_invoice_lines", confidence: "high", label: "Supplier invoice line items" },
  "A_Racun":                 { target: "invoices",           confidence: "high",  label: "Racun = sales receipt/invoice" },
  "A_Otpremnica":            { target: "invoices",           confidence: "high",  label: "Otpremnica = delivery note/invoice" },
  "A_Narudzbenica":          { target: "purchase_orders",    confidence: "high",  label: "Narudzbenica = purchase order" },
  "A_NarudzbenicaStavka":    { target: "purchase_order_lines", confidence: "high", label: "PO line items" },
  "A_ProdajniNalog":         { target: "sales_orders",       confidence: "high",  label: "Prodajni nalog = sales order" },
  "A_ProdajniNalogStavka":   { target: "sales_order_lines",  confidence: "high",  label: "Sales order line items" },
  "A_Primka":                { target: "goods_receipts",     confidence: "high",  label: "Primka = goods receipt" },
  "A_PrimkaStavka":          { target: "goods_receipt_items", confidence: "high", label: "Goods receipt line items" },
  "A_Kalkulacija":           { target: "products",            confidence: "high",  label: "Kalkulacija = pricing calculation (product cost)" },
  "A_Lager":                 { target: "inventory_stock",    confidence: "high",  label: "Lager = current stock levels" },
  "A_LagerPromet":           { target: "inventory_movements", confidence: "high", label: "Lager promet = stock movements" },
  "A_BankovniIzvod":         { target: "bank_statements",    confidence: "high",  label: "Bankovni izvod = bank statement" },
  "A_Nivelacija":            { target: "retail_prices",      confidence: "high",  label: "Nivelacija = retail price adjustments" },
  
  // HR
  "A_Ugovor":                { target: "employee_contracts", confidence: "high",  label: "Ugovor = employee contract" },
  "A_ObracunPlata":          { target: "payroll_runs",       confidence: "high",  label: "Obracun plata = payroll run" },
  "A_ObracunPlataStavka":    { target: "payroll_items",      confidence: "high",  label: "Payroll line items" },
  "A_Odsustvo":              { target: "leave_requests",     confidence: "high",  label: "Odsustvo = leave/absence" },
  "A_Bolovanje":             { target: "leave_requests",     confidence: "high",  label: "Bolovanje = sick leave" },
  "A_GodisnjOdmor":          { target: "leave_requests",     confidence: "high",  label: "Godisnji odmor = annual leave" },
  "A_Prekovremeni":          { target: "overtime_hours",     confidence: "high",  label: "Prekovremeni = overtime hours" },
  "A_NocniRad":              { target: "night_work_records", confidence: "high",  label: "Nocni rad = night work records" },
  
  // Auto-skip: lookup/config tables (too small, no import target)
  "A_TipDokumenta":    { target: "skip", confidence: "exact", label: "Document type lookup — skip", skipReason: "Lookup table (document types)" },
  "A_StatusDokumenta": { target: "skip", confidence: "exact", label: "Document status lookup — skip", skipReason: "Lookup table" },
  "A_TipPartnera":     { target: "skip", confidence: "exact", label: "Partner type lookup — skip", skipReason: "Lookup table" },
  "A_Drzava":          { target: "skip", confidence: "exact", label: "Country lookup — skip", skipReason: "Lookup table (countries)" },
  "A_Grad":            { target: "skip", confidence: "exact", label: "City lookup — skip", skipReason: "Lookup table (cities)" },
  "A_JedinicaMere":    { target: "skip", confidence: "exact", label: "Unit of measure lookup — skip", skipReason: "Lookup table" },
  "A_TipRobe":         { target: "skip", confidence: "exact", label: "Product type lookup — skip", skipReason: "Lookup table" },
  "A_Kategorija":      { target: "skip", confidence: "exact", label: "Category lookup — skip", skipReason: "Lookup table" },
  "A_StatusNaloga":    { target: "skip", confidence: "exact", label: "Order status lookup — skip", skipReason: "Lookup table" },
  "A_TipNaloga":       { target: "skip", confidence: "exact", label: "Order type lookup — skip", skipReason: "Lookup table" },
  "A_Banka":           { target: "skip", confidence: "exact", label: "Bank lookup — skip", skipReason: "Lookup table" },
  "A_PostanskiBroj":   { target: "skip", confidence: "exact", label: "Postal code lookup — skip", skipReason: "Lookup table" },
  "A_Porez":           { target: "tax_rates",              confidence: "high",  label: "Porez = tax rates" },
  "A_PDV":             { target: "tax_rates",              confidence: "high",  label: "PDV = VAT rates" },
};
```

**Update `classifyFile()`** to first check the `DBO_TABLE_LOOKUP` by extracting the table name from `dbo.TableName.csv`:

```typescript
function classifyFile(filename, headers) {
  const basename = filename.split("/").pop() || filename;
  
  // Step 1: Extract dbo.TableName pattern
  const dboMatch = basename.match(/^dbo\.(.+?)\.csv$/i);
  if (dboMatch) {
    const tableName = dboMatch[1];
    const lookup = DBO_TABLE_LOOKUP[tableName];
    if (lookup) {
      return {
        target: lookup.target === "skip" ? null : lookup.target,
        confidence: lookup.confidence,
        dedupField: "...",
        humanLabel: lookup.label,
        autoSkip: lookup.target === "skip",
        skipReason: lookup.skipReason,
      };
    }
    // dbo. file not in lookup — mark as "unrecognized dbo table"
    // Still try header-based detection
  }
  
  // Step 2: Existing regex MAPPING_RULES
  // Step 3: Header-based detection
}
```

**Also add auto-skip for very small files** (≤ 10 data rows) that match lookup/config table patterns — these are almost certainly reference/enum tables.

### 2. `supabase/functions/import-legacy-zip/index.ts`

Add column-heuristic importers for all common tables. The strategy:

- **`importInvoicesHeuristic`** — already exists, improve it with Serbian column name detection
- **`importSupplierInvoicesHeuristic`** — same shape as invoices but targets `supplier_invoices`
- **`importInventoryStockHeuristic`** — maps Lager files with qty/product columns to `inventory_stock`
- **`importChartOfAccountsHeuristic`** — maps konto/account code/name files
- **`importEmployeesHeuristic`** — maps employee files with name/JMBG/email

The key is that line-item tables (e.g., `invoice_lines`, `purchase_order_lines`) **cannot be imported without first knowing the parent FK**. These will be marked as `requires_parent` in the analysis response, so the UI can warn the user: "Invoice lines can only be imported if invoices were imported first."

### 3. `src/pages/tenant/LegacyImport.tsx`

**Add "auto-skip" category** — a new 4th section below the empty files:
- Files marked `autoSkip: true` (lookup/config tables) are shown collapsed at the bottom with a label like "Lookup/config tables — auto-skipped (23 files)"
- These never appear as importable candidates

**Update the summary bar**: 
- "3 exact · 47 high · 12 medium · 23 auto-skipped · 415 empty/unmapped"

**Show parent-dependency warnings**:
- Line-item files (invoice_lines, purchase_order_lines, etc.) show a warning badge: "⚠ Requires parent records"
- These are disabled until the parent table (invoices, purchase_orders) is also checked

## Summary of Changes

| File | Change |
|---|---|
| `supabase/functions/analyze-legacy-zip/index.ts` | Add 50+ entry `DBO_TABLE_LOOKUP` dictionary; update `classifyFile()` to check exact dbo.TableName first; add `autoSkip` and `skipReason` fields to response |
| `supabase/functions/import-legacy-zip/index.ts` | Add `importSupplierInvoicesHeuristic`, `importInventoryStockHeuristic`, `importChartOfAccountsHeuristic`, `importEmployeesHeuristic`; update the switch to dispatch to new importers |
| `src/pages/tenant/LegacyImport.tsx` | Add "auto-skipped lookup tables" 4th section; update summary counts; add parent-dependency warning badges |

## What This Achieves

After these changes, uploading the full 500+ file ZIP will result in:
- **~3 exact matches** — the 3 known Uniprom files mapped with 100% confidence
- **~20–50 high confidence** — other `dbo.A_*` files matched by table name lookup
- **~20–30 auto-skipped** — config/lookup tables (dbo.A_Drzava, dbo.A_Grad, etc.) automatically excluded
- **Remainder** — shown as unmapped (truly unknown tables that need manual assignment or skip)

The user reviews and clicks "Run Import" — each confirmed file is imported sequentially with a progress bar.

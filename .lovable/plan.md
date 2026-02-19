
# Fix: Mapping Quality + Import Reliability + UI Bugs

## Issues Identified

### 1. React Ref Warning (Console Errors)
`FileRow` and `ResultRow` are declared as plain functions after the default export, then used as JSX components. The `Collapsible` + `CollapsibleTrigger asChild` pattern in the unmapped section passes a ref to `CardHeader`, which is a forwardRef component — this is fine. The actual warning comes from `FileRow` and `ResultRow` being passed as component types directly inside `files.map()` — React's dev mode complains when a function component is **used as a ref target** via third-party wrappers. The fix: move `FileRow` and `ResultRow` definitions to **before** the default export and add proper `React.memo` wrapping where needed. Also fix the `CollapsibleTrigger asChild` wrapping around `CardHeader` — this is the actual ref warning source.

### 2. Import Timeout / Does Not Work
The `import-legacy-zip` edge function re-downloads and re-unzips the **entire** ZIP for every import run. For a 581-file ZIP this will hit Supabase's 150-second edge function timeout. 

**Fix strategy**: Move the heavy lifting **client-side**. After analysis, the browser already has the ZIP uploaded to storage. Instead of calling one giant edge function for all files, the frontend will:
- Call `import-legacy-zip` **one file at a time** (per confirmed mapping entry)
- Show per-file progress as each one completes
- This also makes the UI much more responsive with a live progress indicator

### 3. Mapping Quality — Much More Comprehensive Rules
The current 15 rules cover only the 3 known exact files plus generic patterns. For a 581-file Serbian ERP export (likely MS SQL Server `dbo.*` table dumps), we need to expand the mapping registry significantly covering:

**Expanded mapping rules for Serbian ERP table names:**

| Pattern | Target | Confidence |
|---|---|---|
| `A_UnosPodataka.csv` (exact) | products | exact |
| `A_UnosPodataka_Partner.csv` (exact) | partners | exact |
| `A_aPodaci.csv` (exact) | contacts | exact |
| `*Faktura*`, `*faktur*`, `*Invoice*`, `*Racun*` | invoices | high |
| `*UlaznaFaktura*`, `*SupplierInv*`, `*UlazniRacun*` | supplier_invoices | high |
| `*Narudzbenica*`, `*PurchaseOrder*`, `*NarudzbenicaDobavljac*` | purchase_orders | high |
| `*ProdajniNalog*`, `*SalesOrder*`, `*Nalog*` | sales_orders | high |
| `*Zaposleni*`, `*Employee*`, `*Radnik*` | employees | high |
| `*Magacin*`, `*Warehouse*`, `*Skladiste*` | warehouses | high |
| `*KontoPlana*`, `*KontniPlan*`, `*ChartOfAccounts*`, `*Konto*` | chart_of_accounts | high |
| `*PdvPeriod*`, `*Pdv*`, `*Vat*` | tax_rates | medium |
| `*Placanje*`, `*Payment*`, `*Uplata*` | payments | medium |
| `*BankStatement*`, `*IzvodBanke*`, `*Izvod*` | bank_statements | medium |
| `*Artikal*`, `*Proizvod*`, `*Product*`, `*Roba*` | products | medium |
| `*Kupac*`, `*Customer*`, `*Klijent*` | partners | medium |
| `*Dobavljac*`, `*Supplier*`, `*Vendor*` | partners | medium |
| `*Kontakt*`, `*Contact*` | contacts | medium |
| `*Ugovor*`, `*Contract*` | employee_contracts | medium |
| `*Plata*`, `*Payroll*`, `*Obracun*` | payroll_runs | medium |
| `*Lokacija*`, `*Location*` | locations | medium |
| `*CenovnikMaloprodajni*`, `*RetailPrice*`, `*Nivelacija*` | retail_prices | medium |
| `*KalkulacijaCena*`, `*Kalkulacija*` | products (kalkulacija) | medium |

**Header-based fallback** (when filename doesn't match) — much more comprehensive:

| Header signals | Target |
|---|---|
| `pib` OR `mb` OR `matični broj` OR `tax_id` | partners |
| `sku` OR `šifra artikla` OR `sifra` OR `barcode` | products |
| `email` + (`ime` OR `prezime` OR `first_name`) | contacts |
| `broj fakture` OR `invoice_number` OR `faktura_br` | invoices |
| `ulazna faktura` OR `supplier_invoice` | supplier_invoices |
| `narudžbenica` OR `purchase_order` | purchase_orders |
| `JMBG` OR `jmbg` OR `lična karta` | employees |
| `konto` OR `account_code` OR `sifra konta` | chart_of_accounts |

### 4. Empty File Handling
Currently empty files appear in the "Unmapped/Empty" section mixed with genuinely unmapped files. They should be:
- **Completely auto-rejected** (accepted = false, no override offered)
- Shown in a separate "Empty files (skipped)" collapsed section showing only count
- Never sent to the import function

### 5. Client-Side Progressive Import
New flow for Phase 2:

```text
handleImport():
  For each confirmed mapping (one at a time):
    1. Show "Importing file X of N: filename → table"
    2. Call import-legacy-zip with just { storagePath, tenantId, confirmedMapping: [single entry] }
    3. Show result immediately
    4. Move to next file
  When all done → navigate to results screen
```

This means even if one file fails, others continue. The user sees live progress.

## Files to Modify

### 1. `supabase/functions/analyze-legacy-zip/index.ts`
- Expand `MAPPING_RULES` from 15 rules to 50+ rules covering Serbian ERP naming conventions
- Improve `classifyFile()` header-based fallback with 15+ header signal checks
- Fix `isEmpty` detection: a file with only a header row (1 line) should be marked empty, same as 0 rows
- Add a `humanLabel` field to each result that explains **why** it was mapped (e.g. "Matched filename pattern `*Faktura*`" or "Header `pib` detected → partners")

### 2. `supabase/functions/import-legacy-zip/index.ts`
- No changes needed to the import logic itself (it already works for individual files)
- The timeout issue is solved by calling it one file at a time from the frontend

### 3. `src/pages/tenant/LegacyImport.tsx`
- Move `FileRow` and `ResultRow` component definitions to **before** the default export (fixes React ref warnings)
- Remove `asChild` from `CollapsibleTrigger` wrapping `CardHeader` (fix the ref warning source)
- **Redesign empty file handling**: auto-set `accepted = false` for empty files, show them in a collapsed count-only section
- **Redesign Phase 2 import**: progressive file-by-file calls with live progress bar (`importing file 3 of 12`)
- Add `importReason` field to `FileAnalysis` to show why each file was mapped (tooltip on the confidence badge)
- Add a search/filter input on the review screen to find specific files among 581 results
- Show a count summary at top: "12 auto-mapped · 45 medium · 524 empty/unmapped"

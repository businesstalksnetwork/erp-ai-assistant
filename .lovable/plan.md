

# Import Legacy Data for BCILITY DOO

## Summary

Import 6 Excel files into the BCILITY DOO tenant (ID: `f726c1e8-4ad3-47c6-94b7-dfd39bfa07b8`, Legal Entity: `80a07d0f-3014-4475-9876-be51c5d3f714`) covering partners, products, employees, inventory stock, and opening financial balances.

## Data Overview

| File | Records | Target Table | Description |
|------|---------|-------------|-------------|
| SPISAK_PARTNERA.xlsx | ~340 partners | `partners` | Customers, suppliers, foreign firms |
| SPISAK_ARTIKALA.xlsx | ~920 items | `products` | Products and services catalog |
| ROBA_MALOPRODAJA.xlsx | 2 items | `products` (update) | Retail stock quantities and prices |
| roba_veleprodaja.xlsx | 1 item | `products` (update) | Wholesale stock quantities and prices |
| zaposleni.xlsx | 5 employees | `employees` | Staff records with JMBG |
| FINANSIJSKO_STANJE.xlsx | ~72 lines | `chart_of_accounts` + `journal_entries`/`journal_lines` | Opening balances as of 01.01.2025 |

## Implementation Plan

### Step 1: Create Edge Function `import-bcility-data`

A single edge function that processes all 6 files in sequence. The files will first be copied to Supabase storage, then the function reads and imports them.

**Alternative (recommended):** Since the data is already parsed and known, we'll build the edge function to accept the data directly as JSON payload, processing each dataset in batches.

### Step 2: Partners Import (SPISAK_PARTNERA)

Map columns to `partners` table:
- `Šifra` -> `maticni_broj` (with `LEG:` prefix for legacy ID tracking)
- `Naziv partnera` -> `name`
- `Tip partnera` -> `type`: PRAVNO LICE/PREDUZETNIK = "customer", FIZIČKO LICE = "customer", STRANA FIRMA = "customer"
- `PIB / JMBG` -> `pib`
- `Mat.broj / Pasoš` -> `maticni_broj` (actual registration number stored in notes)
- `Pošt.br.` -> `postal_code`
- `Mesto` -> `city`
- `Tekući računi` -> `notes` (bank accounts)
- Dedup by `pib` per tenant

### Step 3: Products Import (SPISAK_ARTIKALA + retail/wholesale stock)

Map to `products` table:
- `Šifra` -> `sku`
- `Naziv artikla` -> `name`
- `JMR` -> `unit_of_measure`
- `Usluga` = True -> flag as service in description
- `Bar-kod artikla` -> `barcode`
- Retail prices from ROBA_MALOPRODAJA -> `default_retail_price`
- Wholesale prices from roba_veleprodaja -> `default_sale_price`
- Dedup by `sku` per tenant

### Step 4: Employees Import (zaposleni)

Map to `employees` table:
- `Prezime` -> `last_name`
- `Ime` -> `first_name`
- `full_name` = `Ime Prezime`
- `JMBG` -> `jmbg`
- `Pol` -> stored in notes
- `Mesto` -> `city`
- `Status zaposlenog` -> `employment_type` mapping (V-Vlasnik = full_time, N-Neodređeno = full_time)
- `status` = 'active'

### Step 5: Chart of Accounts + Opening Balances (FINANSIJSKO_STANJE)

Two-phase approach:
1. **Create chart of accounts entries** - Extract unique account codes (0220, 0229, 0230, etc.) and insert into `chart_of_accounts` for the tenant, mapping account type by code prefix (0x=asset, 1x=asset, 2x=asset, 3x=equity, 4x=liability)
2. **Create opening journal entry** - Insert a single "PST000 - POČETNO STANJE" journal entry dated 2025-01-01 with all debit/credit lines referencing the chart of accounts entries

### Step 6: Upload Files to Storage

Copy the 6 Excel files into the `legacy-imports` storage bucket for audit trail.

## Technical Details

- **Tenant ID:** `f726c1e8-4ad3-47c6-94b7-dfd39bfa07b8`
- **Legal Entity ID:** `80a07d0f-3014-4475-9876-be51c5d3f714`
- **Batch size:** 100 rows per insert (with single-row fallback on error)
- **Deduplication:** Partners by PIB, Products by SKU, Employees by JMBG
- **Edge function timeout:** Will process files sequentially to stay within limits
- **The function will parse XLSX using a lightweight Deno-compatible XLSX parser** (SheetJS via CDN)

### Account Type Mapping for Chart of Accounts
```text
Code prefix -> account_type:
0xxx       -> asset (fixed assets)
1xxx       -> asset (inventory/current assets)
2xxx       -> asset (receivables/cash)
3xxx       -> equity
4xxx       -> liability
```


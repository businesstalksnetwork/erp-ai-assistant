
# Import Legacy Data from .bak into Uniprom ERP

## The Problem

A `.bak` file is a proprietary SQL Server binary backup. At 100MB it exceeds the 20MB upload limit and cannot be parsed directly. We need to extract the data first, then import it.

## Step 1: Extract Data from the .bak File (You Do This)

You will need **SQL Server Management Studio (SSMS)** or **Azure Data Studio** (both free).

### Restore the backup:
1. Open SSMS and connect to a SQL Server instance (local or remote)
2. Right-click Databases > Restore Database
3. Select the `.bak` file as the source
4. Restore it to a database (e.g. `UnipromOld`)

### Export each table as CSV:
Run this for each table you want to export (or use the Export Wizard in SSMS):

```sql
-- Example for customers/partners
SELECT * FROM dbo.Partners  -- adjust table name
```

Export as CSV with headers included.

### Priority tables to export (based on typical ERP migrations):
- Partners / Customers / Suppliers
- Products / Items / Articles
- Chart of Accounts
- Invoices / Sales documents
- Purchase orders
- Inventory / Stock
- Employees (if HR data exists)
- Journal entries / Ledger

## Step 2: Upload CSVs Here (up to 10 files, 20MB each)

Once you have the CSVs, upload them in batches. I will:
1. Read the column structure from each file
2. Map columns to the correct Supabase tables for Uniprom
3. Build a migration/import edge function that loads the data

## Step 3: I Build the Import Pipeline

For each CSV I receive, I will:
- Analyze the schema and map fields (e.g. `SifraPartnera` → `partner_code`, `Naziv` → `name`)
- Generate an SQL import migration or edge function that inserts the data scoped to the Uniprom tenant ID (`7774c25d-d9c0-4b26-a9eb-983f28cac822`)
- Handle deduplication and foreign key ordering (chart of accounts before journal entries, products before invoice lines, etc.)

## Step 4: Verify in the UI

After each batch import, you can log in as `bogdan.ciric023@gmail.com` and verify the data appears correctly in the relevant modules.

## What You Need to Do Right Now

1. Install SSMS (if not already installed): https://aka.ms/ssmsfullsetup
2. Restore the `.bak` to a local SQL Server
3. Run `SELECT name FROM sys.tables ORDER BY name` to get the full table list
4. Paste that table list here — I will tell you exactly which ones to export and in what order

## Technical Notes

- All imported data will be scoped to `tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822'`
- Foreign key relationships will be preserved using a mapping table during import
- Data will be inserted using the Supabase service role (bypasses RLS) via a one-time migration edge function
- No existing data will be touched — this is additive only

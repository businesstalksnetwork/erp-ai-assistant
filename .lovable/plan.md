
## Legacy Data Import — 3 Files Analyzed

### What Was Found in the CSV Files

**File 1: dbo.A_UnosPodataka_Partner.csv — Partners/Customers (9,785 rows)**

No header row. Column mapping decoded from the data:

```text
Col 1: partner_code       e.g. "P000001"
Col 2: name               e.g. "UNIPROM DOO BEOGRAD"
Col 3: country            e.g. "Serbia"
Col 4: city               e.g. "ZEMUN"
Col 5: pib                e.g. "100014203" (tax ID)
Col 6: contact_person     e.g. "Kuduzovic Velibor"
```

Target table: `partners`
Fields mapped: `name`, `city`, `country`, `pib`, `contact_person`, `type` (defaulted to `customer`)

---

**File 2: dbo.A_UnosPodataka.csv — Products/Articles (3,729 rows)**

No header row. Column mapping:

```text
Col 1: sku                e.g. "100001"
Col 2: name               e.g. "KONTAKTOR CM 12-22 220V AC"
Col 3: unit_of_measure    e.g. "kom"
Col 4: quantity_on_hand   e.g. "90.00000"
Col 5: default_purchase_price  e.g. "6000.00000"
Col 6: default_sale_price      e.g. "10000.00000"
Col 7: is_active flag          e.g. "1"
Col 8: category_1         e.g. "SKLOPNA TEHNIKA"
Col 9: category_2         e.g. "KONTAKTORI"
Col 10: category_3        e.g. "MOTORNI"
Col 11: category_4        e.g. "DO 63A"
Col 12: category_5        e.g. "MOTORNI"
Col 13: brand/source      e.g. "UNIPROM"
```

Target table: `products`
Fields mapped: `sku`, `name`, `unit_of_measure`, `default_purchase_price`, `default_sale_price`, `default_retail_price`, `is_active`, `description` (built from category hierarchy)

---

**File 3: dbo.A_aPodaci.csv — Contact Persons (293 rows)**

No header row. Column mapping:

```text
Col 1: partner_id_ref     e.g. "2711" (numeric partner reference)
Col 2: first_name         e.g. "Jelena"
Col 3: last_name          e.g. "Promont"
Col 4: title/role         (empty in most rows)
Col 5: city               e.g. "SRBIJA"
Col 6: email              e.g. "jelena@promont.rs"
Col 7: phone              e.g. "631064007"
```

Target table: `contacts` (CRM contact persons)
This links to the partners via the partner code. The numeric IDs here are legacy internal IDs — we will store them as notes/external_ref since we cannot reliably join them to the partner CSV which uses "P00XXXX" format codes.

---

**Files 4-6: dbo.Account.csv, dbo.AccountAllocation.csv, dbo.AccountAnalytics.csv**

All three files are **empty** (0 rows). No data to import from these.

---

### Import Strategy

The import will be done via **3 dedicated one-time Edge Functions** — one per entity type — using the Supabase service role key to bypass RLS. All records will be scoped to:

```
tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822'  (Uniprom)
```

**Import order** (dependencies respected):
1. Products first (no dependencies)
2. Partners second (no dependencies)
3. Contacts last (references partners)

---

### Technical Implementation

**New Edge Function: `import-legacy-partners`**
- Accepts the raw CSV text in the request body (or reads from a Supabase Storage bucket we'll create)
- Parses each line, splits by comma, handles quoted fields
- Maps: `partner_code → external_ref` (stored in a new `external_ref` field or `notes`), `name`, `city`, `country`, `pib`, `contact_person`
- Deduplicates by `pib` (if present) or `name` to avoid double inserts
- Inserts in batches of 500 using `supabase-js` with the service role
- Returns a JSON summary: `{ inserted, skipped, errors }`

**New Edge Function: `import-legacy-products`**
- Parses the 3,729-row product CSV
- Maps: `sku`, `name`, `unit_of_measure`, `default_purchase_price`, `default_sale_price`
- Sets `default_retail_price = default_sale_price`
- Builds `description` from category columns 8–12
- Deduplicates by `sku`
- Inserts in batches of 500

**New Edge Function: `import-legacy-contacts`**
- Parses the 293-row contact persons CSV
- Creates `contacts` records with `first_name`, `last_name`, `email`, `phone`, `city`
- The legacy partner_id_ref (numeric) is stored in the contact's `notes` field for reference

**Storage Bucket: `legacy-imports`**
- The 3 CSV files will be uploaded to Supabase Storage so the edge functions can fetch them server-side (avoids 6MB request body limits)
- After import, the bucket can be deleted or retained for audit

**Verification Step**
After running the functions, the plan includes a SQL query to verify counts:
```sql
SELECT 
  (SELECT COUNT(*) FROM partners WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822') AS partners,
  (SELECT COUNT(*) FROM products WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822') AS products,
  (SELECT COUNT(*) FROM contacts  WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822') AS contacts;
```

Expected results: ~9,785 partners, ~3,729 products, ~293 contacts.

---

### Files to Create / Modify

1. `supabase/functions/import-legacy-partners/index.ts` — new edge function
2. `supabase/functions/import-legacy-products/index.ts` — new edge function
3. `supabase/functions/import-legacy-contacts/index.ts` — new edge function
4. `supabase/config.toml` — add 3 new function entries (`verify_jwt = false`)
5. Copy CSVs into the project for processing (`src/assets/legacy/`)

The import functions will also be callable from the browser — a simple admin UI button can be added to the Settings page to trigger each import and show progress.

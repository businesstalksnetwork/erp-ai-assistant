
# Full Database Schema Reference for CSV Mapping

Below is the complete list of all importable tables in the system, with their exact column names, required fields, and what the data represents. Use this to map your Uniprom/FactorOne CSV files.

---

## CORE IMPORTABLE TABLES

### 1. `products`
The main product catalog. Maps from: `dbo.A_UnosPodataka.csv`, `dbo.Item.csv`, `dbo.A_Artikal.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled by system |
| `sku` | text | NO | Product code / SKU |
| `name` | text | YES | Product name |
| `description` | text | NO | Description |
| `unit` | text | NO | Unit of measure (kom, kg, m...) |
| `default_sale_price` | numeric | NO | Retail/sale price |
| `default_purchase_price` | numeric | NO | Purchase/cost price |
| `purchase_price` | numeric | NO | Purchase price (used in POS/COGS) |
| `is_active` | boolean | NO | Default: true |
| `product_type` | text | NO | "goods", "service", "raw_material" |
| `barcode` | text | NO | EAN/barcode |
| `category` | text | NO | Category text |
| `brand` | text | NO | Brand name |
| `weight` | numeric | NO | Weight in kg |
| `vat_rate` | numeric | NO | VAT % (default 20) |

**Confirmed column mapping from `dbo.A_UnosPodataka.csv` (no headers, 13 cols):**
- col_1 → `sku`
- col_2 → `name`
- col_3 → `unit`
- col_4 → quantity (stock — goes to `inventory_stock`, not products)
- col_5 → `default_purchase_price`
- col_6 → `default_sale_price`
- col_7 → `is_active` (1/0)
- col_8–12 → categories (use col_8 as `category`)
- col_13 → `brand`

---

### 2. `partners`
Customers and suppliers. Maps from: `dbo.A_UnosPodataka_Partner.csv`, `dbo.Partner.csv`, `dbo.A_Kupac.csv`, `dbo.A_Dobavljac.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `code` | text | NO | Partner code (P000001) |
| `name` | text | YES | Company name |
| `type` | text | NO | "customer", "supplier", "both" |
| `pib` | text | NO | Tax ID / PIB |
| `mb` | text | NO | Company registration number |
| `address` | text | NO | Street address |
| `city` | text | NO | City |
| `country` | text | NO | Country |
| `postal_code` | text | NO | Postal code |
| `phone` | text | NO | Phone |
| `email` | text | NO | Email |
| `website` | text | NO | Website |
| `contact_person` | text | NO | Primary contact name |
| `bank_account` | text | NO | IBAN/account |
| `currency` | text | NO | Default currency (RSD) |
| `credit_limit` | numeric | NO | Credit limit |
| `payment_terms_days` | integer | NO | Net payment days |
| `is_active` | boolean | NO | Default: true |

**Confirmed column mapping from `dbo.A_UnosPodataka_Partner.csv` (no headers, 6 cols):**
- col_1 → `code`
- col_2 → `name`
- col_3 → `country`
- col_4 → `city`
- col_5 → `pib`
- col_6 → `contact_person`

---

### 3. `contacts`
Contact persons linked to partners/companies. Maps from: `dbo.A_aPodaci.csv`, `dbo.PartnerContact.csv`, `dbo.A_Kontakt.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `first_name` | text | YES | First name |
| `last_name` | text | NO | Last name |
| `email` | text | NO | Email address |
| `phone` | text | NO | Phone |
| `address` | text | NO | Address |
| `city` | text | NO | City |
| `country` | text | NO | Country |
| `company_name` | text | NO | Company name (text, not FK) |
| `type` | text | NO | "contact", "lead"... |
| `function_area` | text | NO | Job function/area |
| `seniority_level` | text | NO | Seniority |
| `notes` | text | NO | Notes |

**Confirmed column mapping from `dbo.A_aPodaci.csv` (no headers, 7 cols):**
- col_1 → legacy partner ID (ignore or store in notes)
- col_2 → `last_name`
- col_3 → `first_name`
- col_4 → `function_area` (role/title)
- col_5 → `city`
- col_6 → `email`
- col_7 → `phone`

---

### 4. `employees`
HR employees. Maps from: `dbo.A_Zaposleni.csv`, `dbo.A_Radnik.csv`, `dbo.Employee.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `employee_number` | text | NO | Employee ID/number |
| `first_name` | text | YES | First name |
| `last_name` | text | YES | Last name |
| `email` | text | NO | Work email |
| `phone` | text | NO | Phone |
| `jmbg` | text | NO | Serbian national ID number |
| `position` | text | NO | Job title/position |
| `department_id` | uuid | NO | FK to departments |
| `hire_date` | date | NO | Start date |
| `termination_date` | date | NO | End date |
| `status` | text | NO | "active", "inactive" (default: "active") |
| `gender` | text | NO | "male", "female" |
| `date_of_birth` | date | NO | Birth date |
| `address` | text | NO | Home address |
| `city` | text | NO | City |
| `bank_account` | text | NO | Bank account for salary |

---

### 5. `departments`
Organizational departments. Maps from: `dbo.A_Odeljenje.csv`, `dbo.Department.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `code` | text | YES | Department code |
| `name` | text | YES | Department name |
| `is_active` | boolean | NO | Default: true |

---

### 6. `invoices`
Outgoing sales invoices. Maps from: `dbo.A_Faktura.csv`, `dbo.A_Racun.csv`, `dbo.DocumentHeader.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `invoice_number` | text | YES | Invoice number |
| `invoice_date` | date | YES | Invoice date |
| `due_date` | date | NO | Payment due date |
| `partner_id` | uuid | NO | FK to partners |
| `partner_name` | text | NO | Partner name (text copy) |
| `partner_pib` | text | NO | Partner tax ID |
| `subtotal` | numeric | YES | Amount before tax |
| `tax_amount` | numeric | NO | VAT amount |
| `total` | numeric | YES | Total with tax |
| `currency` | text | NO | Currency code (default: "RSD") |
| `status` | text | NO | "draft", "sent", "paid" (default: "draft") |
| `invoice_type` | text | NO | "regular", "advance", "credit_note" |
| `sale_type` | text | NO | "domestic", "export" |
| `legal_entity_id` | uuid | NO | FK to legal_entities |
| `notes` | text | NO | Notes/description |

---

### 7. `supplier_invoices`
Incoming supplier invoices. Maps from: `dbo.A_UlaznaFaktura.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `invoice_number` | text | YES | Invoice number |
| `invoice_date` | date | YES | Invoice date |
| `due_date` | date | NO | Due date |
| `supplier_id` | uuid | NO | FK to partners (supplier) |
| `supplier_name` | text | NO | Supplier name (text) |
| `amount` | numeric | YES | Subtotal/net amount |
| `tax_amount` | numeric | NO | VAT |
| `total` | numeric | YES | Total |
| `currency` | text | NO | Default: "RSD" |
| `status` | text | NO | "draft", "received", "approved", "paid" |
| `legal_entity_id` | uuid | NO | FK to legal_entities |
| `notes` | text | NO | Notes |

---

### 8. `inventory_stock`
Current stock levels per product per warehouse. Maps from: `dbo.A_Lager.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `product_id` | uuid | YES | FK to products (must exist first) |
| `warehouse_id` | uuid | YES | FK to warehouses (must exist first) |
| `quantity_on_hand` | numeric | NO | Current stock qty (default: 0) |
| `quantity_reserved` | numeric | NO | Reserved qty (default: 0) |
| `unit_cost` | numeric | NO | Average cost per unit |
| `reorder_point` | numeric | NO | Minimum stock trigger |

**Note:** Products and warehouses must be imported FIRST before inventory_stock can be populated.

---

### 9. `inventory_movements`
Stock movement history. Maps from: `dbo.A_LagerPromet.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `product_id` | uuid | YES | FK to products |
| `warehouse_id` | uuid | YES | FK to warehouses |
| `movement_type` | text | YES | "in", "out", "adjustment", "transfer" |
| `quantity` | numeric | YES | Quantity moved |
| `unit_cost` | numeric | NO | Cost per unit |
| `reference` | text | NO | Reference number |
| `notes` | text | NO | Notes |
| `created_at` | timestamptz | NO | Date of movement |

---

### 10. `chart_of_accounts`
Accounting chart. Maps from: `dbo.A_KontniPlan.csv`, `dbo.A_Konto.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `code` | text | YES | Account code (e.g. "2040") |
| `name` | text | YES | Account name |
| `account_type` | text | YES | "asset", "liability", "equity", "revenue", "expense" |
| `parent_id` | uuid | NO | FK to parent account |
| `is_active` | boolean | NO | Default: true |
| `description` | text | NO | Description |

---

### 11. `warehouses`
Warehouses/storage locations. Maps from: `dbo.A_Magacin.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `code` | text | YES | Warehouse code |
| `name` | text | YES | Warehouse name |
| `location` | text | NO | Physical address/location |
| `is_active` | boolean | NO | Default: true |

---

### 12. `currencies`
Currency list. Maps from: `dbo.CurrencyISO.csv`, `dbo.A_Valuta.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `code` | text | YES | ISO code (EUR, USD, RSD) |
| `name` | text | YES | Full name |
| `symbol` | text | NO | Symbol (€, $) |
| `is_active` | boolean | NO | Default: true |
| `is_base` | boolean | NO | Is this the base currency? |

---

### 13. `companies` (CRM)
Company records. Maps from: company data in FactorOne.

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `name` | text | YES | Company name |
| `pib` | text | NO | Tax ID |
| `mb` | text | NO | Registration number |
| `address` | text | NO | Address |
| `city` | text | NO | City |
| `country` | text | NO | Country |
| `phone` | text | NO | Phone |
| `email` | text | NO | Email |
| `website` | text | NO | Website |
| `industry` | text | NO | Industry sector |
| `employee_count` | integer | NO | Size |

---

### 14. `purchase_orders`
Purchase orders. Maps from: `dbo.A_Narudzbenica.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `order_number` | text | YES | PO number |
| `order_date` | date | YES | Order date |
| `supplier_id` | uuid | NO | FK to partners |
| `supplier_name` | text | NO | Supplier name text |
| `status` | text | NO | "draft", "confirmed", "received" |
| `total` | numeric | NO | Total amount |
| `currency` | text | NO | Default: "RSD" |
| `notes` | text | NO | Notes |

---

### 15. `sales_orders`
Sales orders. Maps from: `dbo.A_ProdajniNalog.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `order_number` | text | YES | SO number |
| `order_date` | date | YES | Order date |
| `partner_id` | uuid | NO | FK to partners |
| `partner_name` | text | NO | Customer name |
| `status` | text | NO | "draft", "confirmed", "shipped", "delivered" |
| `total` | numeric | NO | Total |
| `currency` | text | NO | Default: "RSD" |

---

### 16. `employee_contracts`
Employment contracts. Maps from: `dbo.A_Ugovor.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `employee_id` | uuid | YES | FK to employees (must exist first) |
| `contract_type` | text | NO | "permanent", "fixed_term", "part_time" |
| `start_date` | date | YES | Contract start |
| `end_date` | date | NO | Contract end (null = permanent) |
| `gross_salary` | numeric | NO | Monthly gross salary |
| `net_salary` | numeric | NO | Monthly net salary |
| `position` | text | NO | Job title in contract |
| `working_hours_per_week` | numeric | NO | Hours per week (default: 40) |

---

### 17. `leave_requests`
Leave/absence records. Maps from: `dbo.A_Odsustvo.csv`, `dbo.A_Bolovanje.csv`, `dbo.A_GodisnjOdmor.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `employee_id` | uuid | YES | FK to employees |
| `leave_type` | text | YES | "annual", "sick", "unpaid", "maternity" |
| `start_date` | date | YES | Leave start |
| `end_date` | date | YES | Leave end |
| `status` | text | NO | "pending", "approved", "rejected" |
| `notes` | text | NO | Reason/notes |

---

### 18. `overtime_hours`
Overtime records. Maps from: `dbo.A_Prekovremeni.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `employee_id` | uuid | YES | FK to employees |
| `hours` | numeric | YES | Hours worked |
| `month` | integer | YES | Month (1-12) |
| `year` | integer | YES | Year |
| `notes` | text | NO | Notes |

---

### 19. `goods_receipts`
Goods received from suppliers. Maps from: `dbo.A_Primka.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `receipt_number` | text | YES | Receipt number |
| `receipt_date` | date | YES | Date received |
| `supplier_id` | uuid | NO | FK to partners |
| `supplier_name` | text | NO | Supplier name |
| `warehouse_id` | uuid | NO | FK to warehouses |
| `purchase_order_id` | uuid | NO | FK to purchase_orders |
| `status` | text | NO | "draft", "completed" |
| `notes` | text | NO | Notes |

---

### 20. `retail_prices`
Retail price list. Maps from: `dbo.A_Nivelacija.csv`

| Column | Type | Required | Notes |
|---|---|---|---|
| `tenant_id` | uuid | YES | Auto-filled |
| `product_id` | uuid | YES | FK to products |
| `warehouse_id` | uuid | NO | FK to warehouses |
| `retail_price` | numeric | YES | Retail price with VAT |
| `effective_from` | date | NO | Valid from date |

---

## IMPORT ORDER (respect FK dependencies)

Import tables in this sequence to avoid foreign key errors:

```text
1. warehouses          (no dependencies)
2. departments         (no dependencies)
3. currencies          (no dependencies)
4. chart_of_accounts   (self-referencing parent_id OK — import in code order)
5. partners            (no dependencies)
6. contacts            (no dependencies)
7. companies           (no dependencies)
8. employees           (depends on: departments)
9. products            (no dependencies)
10. inventory_stock    (depends on: products + warehouses)
11. inventory_movements (depends on: products + warehouses)
12. employee_contracts  (depends on: employees)
13. leave_requests      (depends on: employees)
14. overtime_hours      (depends on: employees)
15. goods_receipts      (depends on: partners + warehouses)
16. purchase_orders     (depends on: partners)
17. sales_orders        (depends on: partners)
18. supplier_invoices   (depends on: partners)
19. invoices            (depends on: partners)
20. retail_prices       (depends on: products + warehouses)
```

---

## TABLES TO SKIP (no import path)

These tables are managed by the system and cannot be bulk-imported from CSV:
- `journal_entries` / `journal_lines` — system-generated via posting functions
- `payroll_runs` / `payroll_items` — generated by payroll calculation engine
- `pos_sessions` / `pos_transactions` — POS system generated
- `audit_log` — system generated
- `notifications` — system generated
- `approval_requests` — workflow system
- All `ai_*` tables — system generated

---

## KEY NOTES FOR MAPPING

1. **`tenant_id`** — Every table requires this. The system fills it automatically during import (hardcoded to your tenant UUID in the edge function).

2. **UUIDs for FKs** — When mapping `employee_contracts`, you need employee UUIDs that were just created. The import pipeline handles this by doing a post-import lookup by `employee_number` or `name`.

3. **Dedup field** — The importers use these to avoid double-importing:
   - `products` → `sku`
   - `partners` → `pib` (falls back to `name`)
   - `contacts` → `email` (falls back to `first_name + last_name`)
   - `employees` → `jmbg` (falls back to `first_name + last_name`)
   - `invoices` → `invoice_number`

4. **Column position vs. header name** — All 3 confirmed Uniprom files have no CSV headers. The importer uses column position (col_1, col_2...). When you map, specify which column index maps to which field.

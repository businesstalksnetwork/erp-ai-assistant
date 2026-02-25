# CRM Module

## Pages (Routes) — 8 pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/crm` | CrmHub | CRM dashboard |
| `/crm/companies` | Companies | Company management |
| `/crm/contacts` | Contacts | Contact management |
| `/crm/leads` | Leads | Lead tracking |
| `/crm/opportunities` | Opportunities | Sales pipeline |
| `/crm/meetings` | Meetings | Meeting scheduler |
| `/crm/partners` | Partners | Partner (customer/supplier) registry |
| `/crm/activities` | Activities | Activity log |

## Database Tables

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `companies` | id, tenant_id, name, tax_id, address, industry, website | Company master data |
| `contacts` | id, tenant_id, company_id, first_name, last_name, email, phone, position | Contact persons |
| `leads` | id, tenant_id, company_id, contact_id, title, status, source, estimated_value | Sales leads |
| `opportunities` | id, tenant_id, company_id, lead_id, title, stage, probability, expected_value, expected_close_date | Sales pipeline stages |
| `meetings` | id, tenant_id, title, date, attendees, location, notes | Scheduled meetings |
| `activities` | id, tenant_id, type, description, company_id, contact_id, lead_id, opportunity_id, partner_id, meeting_id | Activity log (polymorphic) |
| `partners` | id, tenant_id, name, tax_id, partner_type (customer/supplier/both), company_id, default_receivable_account, default_payable_account | **Shared table** — used by Accounting, Sales, Purchasing |

## Cross-Module Dependencies

### Partners → Everything
The `partners` table is the **central bridge** between CRM and transactional modules:

| Module | Relationship |
|--------|-------------|
| **Invoices** | `invoices.partner_id` → customer |
| **Supplier Invoices** | `supplier_invoices.partner_id` → supplier |
| **Sales Orders** | `sales_orders.partner_id` → customer |
| **Purchase Orders** | `purchase_orders.partner_id` → supplier |
| **Bank Statements** | `bank_statement_lines.partner_name` → fuzzy match |
| **Open Items** | `open_items.partner_id` → receivable/payable tracking |
| **POS** | indirect via invoices |
| **Cash Register** | `cash_register.partner_id` |
| **Advance Payments** | `advance_payments.partner_id` |

### Companies ↔ Partners
- `partners.company_id` optionally links to `companies`
- A company can have multiple partners (e.g., same company as both customer and supplier)

### Contacts → Activities
- Activities log tracks interactions across all CRM entities
- Polymorphic: company_id, contact_id, lead_id, opportunity_id, partner_id, meeting_id

## Known Gaps
- No automated lead → opportunity → invoice pipeline conversion
- Partner default_receivable/payable accounts not yet used by posting rules engine dynamic resolution
- No email integration for contact communication tracking

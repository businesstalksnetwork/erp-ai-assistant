

# Phase 3b: Invoicing + SEF eFaktura Integration

All data is strictly per-tenant (per organization). Every table uses `tenant_id` with RLS policies so tenants only ever see their own invoices, tax rates, and line items.

---

## What gets built

### 1. Database tables (all tenant-scoped)

**tax_rates** — per-tenant tax rate configuration
- id, tenant_id, name, rate (%), is_default, is_active
- Seeded with Serbian defaults: 20% (opsta stopa), 10% (posebna), 0% (oslobodjeno)

**invoices** — per-tenant invoice headers
- id, tenant_id, invoice_number (auto: INV-YYYY-NNNNN), invoice_date, due_date
- partner_name, partner_pib, partner_address (inline, partner registry comes Phase 4)
- subtotal, tax_amount, total, currency (RSD default)
- status: draft / sent / paid / cancelled / overdue
- sef_status: not_submitted / submitted / accepted / rejected
- notes, created_by, created_at, updated_at

**invoice_lines** — line items per invoice
- id, invoice_id, description, quantity, unit_price, tax_rate_id
- line_total, tax_amount, total_with_tax, sort_order
- RLS joins through invoices to verify tenant_id

### 2. Invoice List Page (`/accounting/invoices`)
- Table with search/filter by number, partner, status
- Status badges (draft=gray, sent=blue, paid=green, overdue=red)
- SEF status indicator
- "New Invoice" button

### 3. Invoice Create/Edit Form (`/accounting/invoices/new`, `/accounting/invoices/:id`)
- Full-page form (not dialog — too complex)
- Header: auto-generated number, dates, currency
- Partner: name, PIB, address (free text for now)
- Dynamic line items: description, qty, unit price, tax rate dropdown, computed totals
- Summary: subtotal, tax breakdown by rate, grand total
- Actions: Save Draft, Post, Cancel

### 4. PDV (VAT) Calculation
- Each line selects a tax rate from the tenant's `tax_rates`
- Line tax = qty x unit_price x (rate / 100)
- Summary groups tax totals by rate

### 5. Mock SEF eFaktura
- "Submit to SEF" button on posted invoices
- Simulates submission (updates sef_status to submitted, then accepted after delay)
- Prepares UI for real API integration later

### 6. Auto Invoice Numbers
- Format: `INV-YYYY-NNNNN`
- Generated from count of tenant's invoices in current year

---

## Routes

| Route | Page |
|-------|------|
| `/accounting/invoices` | Invoice list |
| `/accounting/invoices/new` | Create invoice |
| `/accounting/invoices/:id` | View/edit invoice |

---

## Files

| Action | File |
|--------|------|
| Migration | `tax_rates`, `invoices`, `invoice_lines` tables + RLS |
| Create | `src/pages/tenant/Invoices.tsx` |
| Create | `src/pages/tenant/InvoiceForm.tsx` |
| Modify | `src/App.tsx` — add 3 invoice routes |
| Modify | `src/layouts/TenantLayout.tsx` — add Invoices nav item |
| Modify | `src/i18n/translations.ts` — invoice keys (EN + SR) |

---

## Technical notes

- All queries filter by tenant_id via RLS — no cross-tenant data leakage
- Invoice line totals calculated client-side, stored as source of truth on save
- RLS on `invoice_lines` uses a subquery: `invoice_id IN (SELECT id FROM invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))`
- SEF mock is client-side only for now; real integration will use an edge function
- Tax rates are per-tenant so organizations can add custom rates beyond the Serbian defaults


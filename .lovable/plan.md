
# Phase 4: Partner Registry + Dashboard KPIs

This phase adds a partner/contact registry for linking to invoices, and brings the tenant dashboard to life with real financial KPIs pulled from posted journal entries and invoices.

---

## What gets built

### 1. Partners Table (Database)

**partners** -- per-tenant partner/contact registry
- id, tenant_id, name, pib (tax ID), maticni_broj, address, city, postal_code, country
- type: customer / supplier / both
- is_active, created_at, updated_at
- RLS: members can view, admins can manage, super admins full access

### 2. Partners Management Page (`/settings/partners`)

- Table listing all partners with search and type filter (Customer / Supplier / Both)
- Add/Edit dialog with full partner details
- Toggle active/inactive
- Delete with confirmation

### 3. Link Partners to Invoices

- Add `partner_id` (nullable FK) to `invoices` table
- Update InvoiceForm to show a partner dropdown (searchable select)
- When a partner is selected, auto-fill partner_name, partner_pib, partner_address
- Manual override still allowed (for one-off partners)

### 4. Live Dashboard KPIs

Replace the hardcoded "0 RSD" values on the tenant dashboard with real data:
- **Revenue**: Sum of credits on revenue-type accounts from posted journal entries
- **Expenses**: Sum of debits on expense-type accounts from posted journal entries
- **Profit**: Revenue minus Expenses
- **Cash Balance**: Sum of posted invoices marked as "paid"
- **Pending Actions**: Count of draft journal entries + overdue invoices
- **Quick Actions**: Links to create new invoice, new journal entry

---

## Routes

| Route | Page |
|-------|------|
| `/settings/partners` | Partners CRUD |

---

## Files

| Action | File |
|--------|------|
| Migration | `partners` table + RLS; add `partner_id` column to `invoices` |
| Create | `src/pages/tenant/Partners.tsx` |
| Modify | `src/pages/tenant/InvoiceForm.tsx` -- add partner dropdown |
| Modify | `src/pages/tenant/Dashboard.tsx` -- live KPIs from DB |
| Modify | `src/App.tsx` -- add partners route |
| Modify | `src/layouts/TenantLayout.tsx` -- add Partners nav item |
| Modify | `src/i18n/translations.ts` -- add partner keys (EN + SR) |

---

## Technical notes

- Partners table uses standard tenant RLS pattern (get_user_tenant_ids + admin role check)
- Dashboard KPIs query `journal_lines` joined with `journal_entries` (status = 'posted') and `chart_of_accounts` (account_type) for revenue/expense totals
- Partner dropdown in InvoiceForm uses a combobox/select that queries `partners` filtered by tenant
- `partner_id` on invoices is nullable to preserve backward compatibility with existing invoices that have inline partner data
- All queries are tenant-scoped via RLS

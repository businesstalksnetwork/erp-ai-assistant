

## Clear Uniprom Tenant Database

**Tenant:** Uniprom (`7774c25d-d9c0-4b26-a9eb-983f28cac822`)

### What will be deleted

| Table | Rows | Notes |
|-------|------|-------|
| partners | 11,060 | Legacy imported data |
| contacts | 291 | Legacy imported data |
| opportunities | 288 | CRM records |
| invoices + invoice_lines | 3 | Plus dependent lines |
| departments | 12 | Organizational units |

Plus any child/dependent records in: `crm_tasks`, `activities`, `open_items`, `credit_notes`, `quote_lines`, `sales_order_lines`, etc.

### What will be preserved

- **Tenant record** itself (in `tenants` table)
- **Tenant member** (user membership)
- **Legal entity** (1 record)
- **Chart of accounts** (seeded automatically, useful to keep)
- **Tax rates** (seeded automatically)
- **Tenant settings**

### Implementation

Create an edge function `clear-tenant-data` that:

1. Accepts `tenant_id` in the request body (with super_admin auth check)
2. Calls `force_delete_journal_entries` RPC first (handles trigger disabling)
3. Deletes child tables before parent tables (respecting FK order):
   - `invoice_lines`, `credit_notes`, `deferrals` -> then `invoices`
   - `opportunities` -> then `contacts`, `leads`
   - `open_item_payments`, `open_items` -> then `partners`
   - All other transactional tables (`inventory_*`, `pos_*`, `payroll_*`, `wms_*`, etc.)
4. Skips structural/config tables: `tenants`, `tenant_members`, `legal_entities`, `chart_of_accounts`, `tax_rates`, `tenant_settings`
5. Returns a summary of deleted row counts

### Technical Details

**Files to create:**
- `supabase/functions/clear-tenant-data/index.ts` -- New edge function

The function reuses the same FK-aware cleanup pattern from the existing `seed-demo-data` function (lines 134-219), but parameterized to accept any tenant ID instead of being hardcoded. After deployment, it will be called once via the Supabase dashboard or curl to wipe the Uniprom tenant data.

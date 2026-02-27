

## v2.3 Round 1 — P1 Quick Wins (4 items)

### Current State
- **#9 Cron**: Edge functions `recurring-invoice-generate` and `recurring-journal-generate` exist and are deployed, but have no `pg_cron` schedule. Config.toml lacks entries for them.
- **#10 Line items**: `recurring_invoices` table has a `lines: Json` column. The edge function ignores it entirely — creates invoices with `subtotal=0, tax_amount=0, total=0` and no `invoice_lines` rows.
- **#1 OD-O** and **#2 M4**: No existing pages or edge functions. Payroll infrastructure exists (`payroll_runs`, `payroll_items`, `payroll_categories` with `affects_m4` flag). PPP-PD XML generator exists as a pattern to follow.

---

### Implementation Steps

**#9 — Cron schedule for recurring engines (~15 min)**
1. Add `recurring-invoice-generate` and `recurring-journal-generate` to `config.toml` with `verify_jwt = false`
2. Create two `pg_cron` jobs via SQL insert tool (not migration):
   - `recurring-invoice-generate`: daily at 06:00 UTC
   - `recurring-journal-generate`: daily at 06:05 UTC
   - Both call the edge function URL with service role auth

**#10 — Recurring invoice line items (~30 min)**
1. Update `recurring-invoice-generate/index.ts`:
   - After inserting invoice header, parse `tpl.lines` (JSON array)
   - Insert each line into `invoice_lines` with the new `invoice_id`
   - Calculate `subtotal`, `tax_amount`, `total` from lines
   - Update the invoice record with correct totals
2. Update `RecurringInvoices.tsx`:
   - Add a line items editor to the create/edit dialog (description, quantity, unit_price, tax_rate)
   - Save lines as JSON array to the `lines` column

**#1 — OD-O Form (~1.5 hr)**
1. Create DB table `od_o_reports` via migration: `id, tenant_id, employee_id, period_year, period_month, income_type, gross_amount, tax_base, tax_amount, pio_amount, health_amount, net_amount, status, xml_data, created_at`
2. Create page `src/pages/tenant/reports/OdOForm.tsx`:
   - Employee selector, period picker, income type dropdown (royalties, rent, etc.)
   - Calculation logic: apply OD-O specific rates (different from standard payroll)
   - Generate/download XML button
3. Create edge function `generate-od-o-xml/index.ts` — builds XML per Serbian tax authority spec
4. Add route + sidebar entry

**#2 — M4 Annual PIO Report (~1.5 hr)**
1. Create DB table `m4_reports` via migration: `id, tenant_id, legal_entity_id, report_year, status, generated_data, xml_data, created_at`
2. Create page `src/pages/tenant/reports/M4Report.tsx`:
   - Year selector, legal entity selector
   - Aggregates PIO contributions from `payroll_items` for all employees in the year
   - Shows per-employee breakdown: months worked, PIO base, PIO employee, PIO employer
   - Generate/download XML button
3. Create edge function `generate-m4-xml/index.ts` — builds M4 XML for PIO Fund
4. Add route + sidebar entry



# Next Phase: Full Compliance Features Implementation

This plan implements all 6 previously out-of-scope items. The user has emphasized that SEF, eBolovanje, and eOtpremnica connections must be **per-tenant configurations**, manageable from both:
- **Tenant Settings > Integrations** (by tenant admin)
- **Super Admin > Integration Support** (by platform admin helping tenants)

---

## 1. Payroll: max_contribution_base Enforcement (5x Average Wage)

The `payroll_parameters` table already has `min_contribution_base` (51,297) and `max_contribution_base` (732,820) columns. The RPC needs to read from this table.

### Migration: Update `calculate_payroll_for_run` RPC
- Query `payroll_parameters` for the tenant where `effective_from <= period start` (descending, limit 1)
- Use fetched rates (`pio_employee_rate`, `pio_employer_rate`, `health_employee_rate`, etc.) instead of hardcoded values
- Clamp contribution base: `GREATEST(gross, min_base)` then `LEAST(result, max_base)`
- Handle part-time proportional adjustment: `base * work_hours / 40`
- Tax base remains `gross - nontaxable` (not capped same way)

### `src/pages/tenant/Payroll.tsx`
- Fetch active `payroll_parameters` for tenant and display at top (effective date, nontaxable, min/max base)
- Column headers use dynamic rates from parameters instead of hardcoded "PIO 14%", "Zdrav. 5.15%", etc.

---

## 2. Posting Rule Catalog (Tenant-Configurable Account Mappings)

### Migration: New `posting_rule_catalog` table
```
id, tenant_id, rule_code (text, unique per tenant),
description (text), debit_account_code (text), credit_account_code (text),
is_active (bool, default true), created_at, updated_at
```
- RLS: tenant membership scoped
- Seed default rows via trigger on tenant insert (or add to `create-tenant` edge function)
- Default rule codes cover POS (pos_cash_receipt, pos_card_receipt, pos_revenue, pos_output_vat, pos_cogs, pos_retail_inv, pos_reverse_markup, pos_embedded_vat), Invoicing (invoice_ar, invoice_revenue, invoice_output_vat, invoice_cogs, invoice_inventory), and Payroll (payroll_gross_exp, payroll_net_payable, payroll_tax, payroll_bank)

### New page: `src/pages/tenant/PostingRules.tsx`
- Table of all posting rules grouped by module (POS, Invoicing, Payroll)
- Editable account code per rule (validated against `chart_of_accounts`)
- Save updates to `posting_rule_catalog`

### Route and Navigation
- Route: `/settings/posting-rules` in `App.tsx`
- Settings page card in `Settings.tsx` (new icon link)
- Settings nav entry in `TenantLayout.tsx`

### Update RPCs (future migration)
- `process_pos_sale`: Look up accounts from `posting_rule_catalog` instead of hardcoded '2430', '1320', etc.
- `process_invoice_post`: Same pattern
- Payroll posting in `Payroll.tsx` `statusMutation`: Read from catalog

---

## 3. Full SEF Production API with POST/GET Polling + Rate Limiting

### Update `supabase/functions/sef-submit/index.ts`
- In production mode, perform real `POST /publicApi/sales-invoice/ubl/upload/{requestId}` using `connection.api_url` and `connection.api_key_encrypted`
- Handle HTTP 429 (rate limit) -- set status `rate_limited`, return retry-after hint
- Handle HTTP 4xx/5xx -- set status `error`, store response body

### New edge function: `supabase/functions/sef-poll-status/index.ts`
- Accepts `tenant_id` + optional `invoice_id` (single) or batch mode (all pending)
- Queries `sef_submissions` where `status IN ('submitted', 'pending')`
- For each, calls `GET /publicApi/sales-invoice/status/{requestId}` using stored requestId
- Rate limiter: max 3 calls/sec (`await sleep(334)` between calls)
- Updates `sef_submissions.status` and `invoices.sef_status` to terminal state
- JWT auth required

### `src/pages/tenant/Invoices.tsx`
- Add "Poll Status" button for invoices with `sef_status === 'submitted'` or `'pending'`
- Calls `sef-poll-status` edge function, shows result toast

### Config
- Register `sef-poll-status` in `supabase/config.toml`

---

## 4. Full eBolovanje Module (Per-Tenant Connection + CRUD)

### Migration: New tables
**`ebolovanje_connections`** (per-tenant config):
```
id, tenant_id (unique), euprava_username, euprava_password_encrypted,
certificate_data, environment (sandbox/production),
is_active (bool), last_sync_at, last_error, created_at, updated_at
```

**`ebolovanje_claims`**:
```
id, tenant_id, employee_id, legal_entity_id,
claim_type (sick_leave/maternity/work_injury),
start_date, end_date, diagnosis_code, doctor_name, medical_facility,
rfzo_claim_number, status (draft/submitted/confirmed/rejected/paid),
submitted_at, confirmed_at, amount, notes,
created_by, created_at, updated_at
```

**`ebolovanje_doznake`** (confirmations):
```
id, tenant_id, claim_id (FK), doznaka_number,
issued_date, valid_from, valid_to,
rfzo_status, response_payload (jsonb), created_at
```

All with RLS scoped to tenant membership.

### `src/pages/tenant/EBolovanje.tsx` -- Full rewrite
Replace the stub with:
- Table listing claims with status badges
- Create dialog: employee selector, date range, claim type, diagnosis info
- Status advancement buttons (draft -> submitted -> confirmed)
- Detail view with linked doznake
- Filter by status, date range, employee

### New edge function: `supabase/functions/ebolovanje-submit/index.ts`
- Accepts `claim_id`, `tenant_id`
- Loads connection from `ebolovanje_connections`
- Builds RFZO-compatible payload from claim data
- Stub for actual eUprava API call (placeholder with correct data structure)
- Updates claim status to `submitted`

### Per-Tenant Connection Settings
**`src/pages/tenant/Integrations.tsx`**: Add eBolovanje connection card (similar pattern to existing SEF card):
- Show connection status, toggle active/inactive
- Edit form: eUprava username, password, environment
- Test connection button

**`src/pages/super-admin/IntegrationSupport.tsx`**: Add eBolovanje section:
- Table of all tenants with their eBolovanje connection status
- Configure button opening dialog (same as SEF pattern)

---

## 5. eOtpremnica API Integration (Per-Tenant Connection)

### Migration
**`eotpremnica_connections`** (per-tenant config):
```
id, tenant_id (unique), api_url, api_key_encrypted,
environment (sandbox/production), is_active (bool),
last_sync_at, last_error, created_at, updated_at
```

**Add columns to `eotpremnica`**:
- `api_status` (text, default 'not_submitted')
- `api_request_id` (text)
- `api_response` (jsonb)

### New edge function: `supabase/functions/eotpremnica-submit/index.ts`
- Accepts `eotpremnica_id`, `tenant_id`
- Loads dispatch note with lines from DB
- Loads connection from `eotpremnica_connections`
- Builds XML payload per Ministry specification (sender/receiver PIB, vehicle, lines)
- Stub for actual API POST
- Updates eotpremnica `api_status` and stores response

### `src/pages/tenant/Eotpremnica.tsx`
- Add "Submit to eOtpremnica" button (visible when status is `confirmed` and connection is active)
- Show `api_status` badge column

### Per-Tenant Connection Settings
**`src/pages/tenant/Integrations.tsx`**: Add eOtpremnica connection card:
- Connection status, toggle, edit form (API URL, key, environment)
- Test connection button

**`src/pages/super-admin/IntegrationSupport.tsx`**: Add eOtpremnica section:
- Table of all tenants with their eOtpremnica connection status
- Configure button

---

## 6. Offline Fiscal Receipt PFR Retry + Verification

### Migration: Add columns to `fiscal_receipts`
- `retry_count` (integer, default 0)
- `last_retry_at` (timestamptz)
- `verification_status` (text, default 'pending')

### New edge function: `supabase/functions/fiscalize-retry-offline/index.ts`
- Queries `fiscal_receipts` where `receipt_number LIKE 'OFFLINE-%'` for the tenant
- Re-posts stored `pfr_request` to `device.api_url/api/v3/invoices`
- On success: updates receipt_number, qr_code_url, signed_at, pfr_response, verification_status
- On failure: increments retry_count, caps at 5
- JWT auth required

### `src/pages/tenant/FiscalDevices.tsx`
- Add "Offline Receipts" panel showing count per device
- "Retry All Offline" button calling edge function
- Table of offline receipts with retry status

---

## Implementation Order

1. **Migration: payroll RPC update** (max_contribution_base + dynamic rates)
2. **Migration: posting_rule_catalog table** + seed defaults
3. **Migration: ebolovanje_connections + ebolovanje_claims + ebolovanje_doznake tables**
4. **Migration: eotpremnica_connections table + eotpremnica columns**
5. **Migration: fiscal_receipts columns**
6. **Edge functions**: sef-poll-status, ebolovanje-submit, eotpremnica-submit, fiscalize-retry-offline
7. **Update sef-submit**: production API calls
8. **Frontend**: PostingRules page + route/nav
9. **Frontend**: EBolovanje full rewrite
10. **Frontend**: Integrations.tsx -- add eBolovanje + eOtpremnica connection cards
11. **Frontend**: IntegrationSupport.tsx -- add eBolovanje + eOtpremnica sections
12. **Frontend**: Eotpremnica.tsx -- add submit button + api_status
13. **Frontend**: FiscalDevices.tsx -- add offline retry panel
14. **Frontend**: Invoices.tsx -- add poll status button
15. **Frontend**: Payroll.tsx -- dynamic rate headers + parameters display
16. **Translations**: All new keys in en + sr

---

## Files Changed Summary

### New Files
- `src/pages/tenant/PostingRules.tsx`
- `supabase/functions/sef-poll-status/index.ts`
- `supabase/functions/ebolovanje-submit/index.ts`
- `supabase/functions/eotpremnica-submit/index.ts`
- `supabase/functions/fiscalize-retry-offline/index.ts`

### Modified Files
- `src/App.tsx` (new route: posting-rules)
- `src/layouts/TenantLayout.tsx` (nav entry for posting rules)
- `src/pages/tenant/Settings.tsx` (posting rules card)
- `src/pages/tenant/Integrations.tsx` (eBolovanje + eOtpremnica cards)
- `src/pages/super-admin/IntegrationSupport.tsx` (eBolovanje + eOtpremnica sections)
- `src/pages/tenant/EBolovanje.tsx` (full rewrite from stub)
- `src/pages/tenant/Eotpremnica.tsx` (submit button + api_status)
- `src/pages/tenant/FiscalDevices.tsx` (offline retry panel)
- `src/pages/tenant/Invoices.tsx` (poll status button)
- `src/pages/tenant/Payroll.tsx` (dynamic rates + parameters display)
- `supabase/functions/sef-submit/index.ts` (production API calls)
- `supabase/config.toml` (new functions)
- `src/i18n/translations.ts` (new keys)

### New Migrations (5)
1. Update `calculate_payroll_for_run` RPC with dynamic rates + base clamping
2. Create `posting_rule_catalog` table + RLS + seed trigger
3. Create `ebolovanje_connections`, `ebolovanje_claims`, `ebolovanje_doznake` + RLS
4. Create `eotpremnica_connections` + add columns to `eotpremnica` + RLS
5. Add columns to `fiscal_receipts` (retry_count, last_retry_at, verification_status)

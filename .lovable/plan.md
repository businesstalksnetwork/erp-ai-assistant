

# Phase 3: Integration Completion

## Overview

Three areas of work: (1) add a "Poll All SEF Statuses" button plus a scheduled cron job, (2) add a daily cron trigger for NBS exchange rates, and (3) harden the eBolovanje and eOtpremnica Edge Functions with proper field validation matching Serbian government API specs.

---

## 1. SEF Polling -- UI Button + Cron Job

### Current State
- `sef-poll-status` Edge Function exists and works (sandbox simulation + production API call)
- Invoices page already has a per-invoice "Poll Status" button for `submitted`/`polling` invoices
- No bulk polling or scheduled polling exists

### Changes

**A. Add "Poll All" button to Invoices page** (`src/pages/tenant/Invoices.tsx`)
- Add a toolbar-level "Refresh SEF Statuses" button (RefreshCw icon) that calls `sef-poll-status` with `{ tenant_id }` only (no `invoice_id`), which already polls ALL pending submissions
- Show a loading spinner during the poll, then invalidate the invoices query

**B. Add cron job via SQL** (run via Supabase SQL, not migration)
- Enable `pg_cron` and `pg_net` extensions
- Schedule `sef-poll-status` to run every 15 minutes during business hours (Mon-Fri, 07:00-20:00 CET)
- The function already handles the case where there are no pending submissions gracefully
- Since the cron calls without a user JWT, modify `sef-poll-status` to accept a service-role-key-based call that iterates all tenants with active SEF connections

**C. Update `sef-poll-status` Edge Function** (`supabase/functions/sef-poll-status/index.ts`)
- Add a "cron mode": when called without `tenant_id` but with a valid service role key (via `Authorization: Bearer <service_role_key>`), iterate all active `sef_connections` and poll pending submissions for each tenant
- Keep existing per-tenant behavior when `tenant_id` is provided

---

## 2. NBS Exchange Rates -- Daily Cron

### Current State
- `nbs-exchange-rates` Edge Function exists and works (fetches from NBS API, skips weekends/holidays)
- Manual "Import NBS Rates" button exists on the Currencies page
- No scheduled trigger

### Changes

**A. Update `nbs-exchange-rates` Edge Function** (`supabase/functions/nbs-exchange-rates/index.ts`)
- Add a "cron mode": when called without `tenant_id`, iterate all tenants that have at least one active currency with `auto_import_rates = true` (or simply all tenants, since rates are universally useful)
- Actually, simpler approach: iterate all distinct `tenant_id` values from the `currencies` table and import rates for each

**B. Add cron job via SQL** (run via Supabase SQL, not migration)
- Schedule daily at 08:30 CET (after NBS publishes the day's rates, typically by 08:00)
- `select cron.schedule('nbs-daily-rates', '30 6 * * 1-5', ...)` (06:30 UTC = 08:30 CET, weekdays only)

---

## 3. eBolovanje + eOtpremnica Payload Validation

### Current State
- Both Edge Functions accept payloads and store them but do minimal validation
- eBolovanje builds an RFZO payload with employee/employer data
- eOtpremnica builds a Ministry payload with sender/receiver/vehicle data
- Both have sandbox simulation and production placeholder paths

### Changes

**A. Harden `ebolovanje-submit`** (`supabase/functions/ebolovanje-submit/index.ts`)

Add validation before submission:
- `employee_id` must resolve to an employee with a valid 13-digit JMBG
- `legal_entity_id` must resolve to an entity with a valid PIB (9 digits)
- `start_date` required, must be valid ISO date
- `end_date` if provided, must be >= `start_date`
- `claim_type` must be one of: `sick_leave`, `maternity`, `work_injury`
- `diagnosis_code` required for `sick_leave` and `work_injury` (ICD-10 format validation: letter + 2-3 digits + optional dot + digits)
- `doctor_name` required for all claim types
- `medical_facility` required for all claim types
- Return 400 with specific validation error messages listing all failures

**B. Harden `eotpremnica-submit`** (`supabase/functions/eotpremnica-submit/index.ts`)

Add validation before submission:
- `sender_name` required, non-empty
- `receiver_name` required, non-empty
- `sender_pib` if provided, must be valid 9-digit PIB
- `receiver_pib` if provided, must be valid 9-digit PIB
- `vehicle_plate` required for `in_transit` status -- must match Serbian plate format (e.g., `BG-123-AA` or similar patterns)
- `driver_name` required when `vehicle_plate` is provided
- At least one `eotpremnica_lines` entry must exist
- Each line must have `description` (non-empty), `quantity` (> 0), `unit` (non-empty)
- Return 400 with specific validation error messages

**C. Update UI feedback** (`src/pages/tenant/EBolovanje.tsx`, `src/pages/tenant/Eotpremnica.tsx`)
- Display validation errors returned from the Edge Functions in toast messages (already handled by existing error toasts, but ensure the error messages are user-friendly)

---

## Technical Details

### Files Modified
1. `supabase/functions/sef-poll-status/index.ts` -- Add cron mode (no tenant_id = poll all tenants)
2. `supabase/functions/nbs-exchange-rates/index.ts` -- Add cron mode (no tenant_id = all tenants)
3. `supabase/functions/ebolovanje-submit/index.ts` -- Add payload validation
4. `supabase/functions/eotpremnica-submit/index.ts` -- Add payload validation
5. `src/pages/tenant/Invoices.tsx` -- Add "Poll All SEF" toolbar button
6. `src/i18n/translations.ts` -- Add translation keys for new labels and validation messages

### Cron Jobs (run via SQL after implementation, not as migrations)

```sql
-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- SEF polling: every 15 min, weekdays 07:00-20:00 CET (05:00-18:00 UTC)
select cron.schedule(
  'sef-poll-all-statuses',
  '*/15 5-18 * * 1-5',
  $$
  select net.http_post(
    url:='https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/sef-poll-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- NBS daily rates: 08:30 CET (06:30 UTC), weekdays
select cron.schedule(
  'nbs-daily-rates',
  '30 6 * * 1-5',
  $$
  select net.http_post(
    url:='https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/nbs-exchange-rates',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Validation Helper Functions (shared patterns in Edge Functions)

```typescript
function validatePib(pib: string): boolean {
  return /^\d{9}$/.test(pib);
}

function validateJmbg(jmbg: string): boolean {
  return /^\d{13}$/.test(jmbg);
}

function validateIcd10(code: string): boolean {
  return /^[A-Z]\d{2}(\.\d{1,2})?$/i.test(code);
}

function validateSerbianPlate(plate: string): boolean {
  // Formats: BG123AA, BG-123-AA, etc.
  return /^[A-Z]{2}\s?-?\s?\d{2,4}\s?-?\s?[A-Z]{2}$/i.test(plate);
}
```

### No Database Changes Required
All existing tables and columns support these changes. The cron jobs use existing Edge Functions with extended behavior.


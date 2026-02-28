

# V3.2 Critical Fixes + AI Not Working

## AI Issue Investigation Results

From the network logs captured during your session:

- `ai-insights` edge function: **works** (returned 200 with full data)
- `ai-daily-digest` edge function: **no request captured** — the AI briefing widget on the dashboard shows a loading skeleton but the function call never fires
- `ai-assistant` edge function: **no recent logs at all** — the Copilot chat hasn't been invoked recently
- `LOVABLE_API_KEY`: **configured and present**

The blank grey area on the dashboard is the AI Briefing widget stuck in a loading/skeleton state. The root cause is likely one of:
1. A stale React Query error cache preventing the `supabase.functions.invoke("ai-daily-digest")` call from re-firing
2. The lazy-loaded `AiBriefingWidget` component not resolving from Suspense

**Fix:** Add error handling and retry logic to the `AiBriefingWidget` so it shows an error state with a retry button instead of silently returning `null` on failure. Also redeploy both `ai-daily-digest` and `ai-assistant` functions to ensure they're running the latest code.

---

## Combined Plan: V3.2 Fixes + AI Reliability

### Task 1: Payroll RPC — Rename + Fix (DB Migration)
Create a new migration that:
- `DROP FUNCTION IF EXISTS public.calculate_payroll(uuid)`
- `CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(...)` with the corrected body
- Remove duplicate `pension_employer`/`health_employer` columns from INSERT (keep only `employer_pio`/`employer_health`)
- Replace `v_wd := 22` with dynamic weekday count for the month
- Fix leave counting to query `leave_requests` with day-range overlap instead of `COUNT(*)`
- Fix sick leave to query `leave_requests WHERE leave_type = 'sick'` instead of `attendance_records`

### Task 2: Returns.tsx GL Account Fix (CR2-04)
Change `accountCode: "1200"` → `"2040"` on the customer return credit note AR entry (line ~242).

### Task 3: compliance-checker SQL Injection Fix (CR2-05)
Replace all `'${tenantId}'` string interpolations with the Supabase client API (`.from().select()`) or parameterized RPC calls throughout `supabase/functions/compliance-checker/index.ts`.

### Task 4: Edge Function Fixes
- **generate-payment-orders**: Fix dead tenant check code for payroll path
- **generate-croso-xml**: Remove invalid `<SifraPlacanja>240</SifraPlacanja>` from M-1 XML

### Task 5: Frontend Fixes (6 files)
- `IntercompanyEliminations.tsx`: Add `.eq("tenant_id", tenantId!)` to update
- `TaxLossCarryforward.tsx`, `ThinCapitalization.tsx`: Change `ZPDP` → `ZPDPL`
- `MultiPeriodReports.tsx`: Remove negation on assets delta
- `DeferredTax.tsx`: Remove `Math.abs()` wrappers
- `VatProRata.tsx`: Add `.eq("year", year)` to queryFn

### Task 6: Fix AI Briefing Widget + Redeploy AI Functions
- In `AiBriefingWidget.tsx`: Add `retry: 2` to the React Query config, add an error state with retry button instead of returning `null`
- Redeploy `ai-daily-digest` and `ai-assistant` edge functions

**Total: 1 migration, 3 edge functions, ~8 frontend files**


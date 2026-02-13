

# Fix NBS Exchange Rates: Audit-Compliant Rate Import

## Problem

The `nbs-exchange-rates` edge function has three compliance issues:

1. **Silent hardcoded fallback** -- When the NBS API fails, it silently inserts stale hardcoded rates (EUR 117.17, USD 108.45, etc.) with no indication to the user or admin. This breaks audit traceability.
2. **No weekend/holiday logic** -- NBS does not publish rates on weekends or Serbian national holidays. The function requests today's date blindly, gets no data, then falls back to hardcoded rates.
3. **No admin notification** -- When rate import fails, nobody is alerted.

## Solution

Rewrite the function to:
- Detect weekends and Serbian national holidays, automatically resolve to the last working day
- Remove hardcoded fallback rates entirely
- Fail loudly with a 500 error when NBS API returns no data
- Send admin notifications (via `create-notification` pattern) when import fails or when non-working-day adjustment occurs

---

## Implementation Details

### File: `supabase/functions/nbs-exchange-rates/index.ts`

**1. Add "last working day" resolver**

```typescript
// Helper: format Date as YYYY-MM-DD without timezone issues
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

// Query the holidays table for national holidays (tenant_id IS NULL)
async function isNationalHoliday(supabase, dateStr: string): Promise<boolean> {
  const { data } = await supabase
    .from("holidays")
    .select("id")
    .is("tenant_id", null)
    .eq("date", dateStr)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// Walk backwards from today until we find a working day (max 10 days back)
async function getLastWorkingDay(supabase): Promise<string> {
  const d = new Date();
  for (let i = 0; i < 10; i++) {
    const dateStr = formatDate(d);
    if (!isWeekend(d) && !(await isNationalHoliday(supabase, dateStr))) {
      return dateStr;
    }
    d.setDate(d.getDate() - 1);
  }
  throw new Error("Could not determine last working day within 10-day window");
}
```

**2. Remove hardcoded fallback, fail loudly**

Replace the current silent fallback block (lines 80-88) with an error:

```typescript
if (rates.length === 0) {
  // Send admin notification about failure
  await sendAdminNotification(supabase, tenant_id, targetDate);

  return new Response(
    JSON.stringify({
      error: "NBS API returned no exchange rates",
      details: `No rates available for ${targetDate}. NBS may be unavailable. Admin has been notified.`,
    }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**3. Admin notification on failure**

Use the existing `notifications` table (same pattern as `create-notification` function):

```typescript
async function sendAdminNotification(
  supabase, tenant_id: string, date: string
) {
  // Find admin users for this tenant
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenant_id)
    .eq("role", "admin");

  if (!admins?.length) return;

  const rows = admins.map((a) => ({
    tenant_id,
    user_id: a.user_id,
    type: "warning",
    category: "system",
    title: "NBS Exchange Rate Import Failed",
    message: `Failed to fetch exchange rates from NBS for ${date}. Rates were NOT imported. Please retry or enter rates manually.`,
    entity_type: "exchange_rates",
    entity_id: null,
  }));

  await supabase.from("notifications").insert(rows);
}
```

**4. Use `formatDate` instead of `toISOString().split("T")[0]`**

Replace line 55 to avoid UTC timezone shift issues (e.g., calling at 23:30 CET would produce tomorrow's UTC date):

```typescript
const targetDate = await getLastWorkingDay(supabase);
```

**5. Also log non-working-day adjustment**

When today is not a working day, include the adjustment info in the success response:

```typescript
const today = formatDate(new Date());
const adjusted = targetDate !== today;

return new Response(
  JSON.stringify({
    success: true,
    imported,
    date: targetDate,
    adjusted,
    ...(adjusted ? { originalDate: today, reason: "Weekend or national holiday" } : {}),
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## Complete Flow After Fix

```text
Request arrives with tenant_id
    |
    v
JWT validation + tenant membership check (already done)
    |
    v
Resolve target date: walk back from today, skip weekends + national holidays
    |
    v
Fetch NBS API for target date
    |
    +---> Rates found: upsert into exchange_rates, return success
    |
    +---> No rates / API error:
              - Send warning notification to tenant admins
              - Return 502 error with details (NO hardcoded fallback)
```

---

## Frontend Impact

The `Currencies.tsx` page already shows toast errors from the function response. With the new 502 error, it will display a clear message like "NBS API returned no exchange rates. Admin has been notified." instead of silently importing wrong hardcoded values.

No frontend changes needed.

---

## Files Modified

1. `supabase/functions/nbs-exchange-rates/index.ts` -- Full rewrite of rate fetching logic

## What This Fixes

- **Audit compliance**: No more phantom rates from hardcoded values polluting the general ledger
- **Weekend/holiday handling**: Automatically uses last working day's rates (NBS standard behavior)
- **Timezone safety**: Uses manual date formatting instead of `toISOString()` which can shift dates near midnight CET
- **Admin visibility**: Tenant admins get notified immediately when rate import fails
- **Traceability**: Response includes whether date was adjusted and why



# Security and Connectivity Remediation Plan

Addresses all critical findings from the audit: route protection gaps, cross-tenant data exposure, unsecured cron endpoints, missing routes, and SEF compliance.

---

## 1. Protect Unguarded Settings Routes

**File: `src/App.tsx`**

Currently these settings routes have NO `requiredModule` wrapper and are accessible by any authenticated user via direct URL:

- `/settings` (line 179)
- `/settings/legal-entities` (line 182)
- `/settings/locations` (line 183)
- `/settings/warehouses` (line 184)
- `/settings/cost-centers` (line 186)
- `/settings/bank-accounts` (line 187)

Wrap each with `<ProtectedRoute requiredModule="settings">`:

```
<Route path="settings" element={<ProtectedRoute requiredModule="settings"><TenantSettings /></ProtectedRoute>} />
<Route path="settings/legal-entities" element={<ProtectedRoute requiredModule="settings"><LegalEntities /></ProtectedRoute>} />
<Route path="settings/locations" element={<ProtectedRoute requiredModule="settings"><Locations /></ProtectedRoute>} />
<Route path="settings/warehouses" element={<ProtectedRoute requiredModule="settings"><Warehouses /></ProtectedRoute>} />
<Route path="settings/cost-centers" element={<ProtectedRoute requiredModule="settings"><CostCenters /></ProtectedRoute>} />
<Route path="settings/bank-accounts" element={<ProtectedRoute requiredModule="settings"><BankAccounts /></ProtectedRoute>} />
```

Also register the missing calendar route (currently imported but never registered):

```
<Route path="production/ai-planning/calendar" element={<ProtectedRoute requiredModule="production"><AiPlanningCalendar /></ProtectedRoute>} />
```

---

## 2. Fix Cross-Tenant Data Exposure in Edge Functions

### 2a. `supabase/functions/sef-submit/index.ts` (line 394-398)

**Problem:** Invoice is fetched by `id` only -- no `tenant_id` filter. A user in Tenant A could submit Tenant B's invoice by supplying `tenant_id=A` and `invoice_id=<Tenant B UUID>`.

**Fix:** Add `.eq("tenant_id", tenant_id)` to the invoice query:

```typescript
const { data: invoice, error: invErr } = await supabase
  .from("invoices")
  .select("*, invoice_lines(*)")
  .eq("id", invoice_id)
  .eq("tenant_id", tenant_id)  // ADD THIS
  .single();
```

### 2b. `supabase/functions/fiscalize-receipt/index.ts` (lines 62-67)

**Problem:** Fiscal device loaded by `device_id` only -- no `tenant_id` filter. Exposes device configuration across tenants. Also, `tenant_id` is optional (`if (tenant_id)` guard on line 52).

**Fix:** Make `tenant_id` required and add it to the device query:

```typescript
// Make tenant_id required (replace lines 52-60)
if (!tenant_id) {
  return new Response(JSON.stringify({ error: "tenant_id required" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const { data: membership } = await supabase
  .from("tenant_members").select("id")
  .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
if (!membership) {
  return new Response(JSON.stringify({ error: "Forbidden" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Add tenant_id filter to device query (line 63-67)
const { data: device, error: deviceErr } = await supabase
  .from("fiscal_devices")
  .select("*")
  .eq("id", device_id)
  .eq("tenant_id", tenant_id)  // ADD THIS
  .single();
```

---

## 3. Secure Public Cron-Mode Endpoints

### 3a. `supabase/functions/sef-poll-status/index.ts`

**Problem:** When called without `tenant_id` (cron mode), no authentication is required. Anyone can poll all active SEF connections and get results.

**Fix:** Add a secret header check for cron mode:

```typescript
// After parsing body, before cron processing:
if (!tenant_id) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // ... existing cron logic
}
```

### 3b. `supabase/functions/nbs-exchange-rates/index.ts`

**Problem:** Same pattern -- cron mode (no `tenant_id`) requires no authentication and processes all tenants.

**Fix:** Same secret header check:

```typescript
if (!tenant_id) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // ... existing cron logic
}
```

### 3c. Add `CRON_SECRET` to Edge Function secrets

Generate a strong random secret and add it via the Supabase secrets configuration. Update any pg_cron scheduled jobs to include the `x-cron-secret` header.

---

## 4. SEF UBL PriceAmount Precision Fix

**File: `supabase/functions/sef-submit/index.ts` (line 21-23)**

**Problem:** `formatAmount()` uses `.toFixed(2)` for all amounts. Serbian SEF specification allows up to 4 decimal places for `cbc:PriceAmount` in invoice lines.

**Fix:** Add a separate formatter for line prices:

```typescript
function formatAmount(n: number): string {
  return n.toFixed(2);
}

function formatPrice(n: number): string {
  // SEF allows up to 4 decimals for cbc:PriceAmount
  const s = n.toFixed(4);
  // Trim trailing zeros but keep at least 2 decimals
  return s.replace(/0{1,2}$/, '');
}
```

Then update the UBL builder (line 138) to use `formatPrice` for PriceAmount:

```xml
<cbc:PriceAmount currencyID="...">${formatPrice(line.unit_price)}</cbc:PriceAmount>
```

---

## 5. Tighten ALWAYS_ON Module List

**File: `src/hooks/usePermissions.ts` (lines 9-14)**

**Problem:** The `ALWAYS_ON` array includes granular settings sub-modules (`settings-users`, `settings-approvals`, etc.), which defeats the Super Admin's ability to disable modules per tenant.

**Fix:** Reduce ALWAYS_ON to only truly universal modules:

```typescript
const ALWAYS_ON: ModuleGroup[] = ["dashboard", "settings"];
```

All other settings sub-modules (`settings-users`, `settings-approvals`, `settings-business-rules`, `settings-tax-rates`, `settings-currencies`, `settings-audit-log`, `settings-events`, `settings-integrations`) will then respect the tenant module toggles. Roles still control access via `rolePermissions`, so admin/manager users still see these when the tenant has them enabled.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/App.tsx` | Wrap 6 unprotected settings routes with `requiredModule="settings"`, add missing calendar route |
| `src/hooks/usePermissions.ts` | Reduce ALWAYS_ON to `["dashboard", "settings"]` |
| `supabase/functions/sef-submit/index.ts` | Add `.eq("tenant_id", tenant_id)` on invoice query; add `formatPrice()` for 4-decimal PriceAmount |
| `supabase/functions/fiscalize-receipt/index.ts` | Make `tenant_id` required; add `.eq("tenant_id", tenant_id)` on fiscal_devices query |
| `supabase/functions/sef-poll-status/index.ts` | Add `x-cron-secret` validation for cron mode |
| `supabase/functions/nbs-exchange-rates/index.ts` | Add `x-cron-secret` validation for cron mode |
| Supabase secrets | Add `CRON_SECRET` environment variable |

No database migrations required. All changes are code-level security hardening.


# P0 Security Fix: Tenant Membership Guards for All Edge Functions

## Problem

14 out of 17 edge functions allow any authenticated user to access ANY tenant's data by simply passing a different `tenant_id`. Two functions (`nbs-exchange-rates`, `wms-slotting`) have zero authentication at all.

## Solution

Add a shared tenant membership verification pattern to every function that accesses tenant-scoped data. The guard verifies the authenticated user is an active member of the requested tenant before proceeding.

---

## Guard Pattern (applied to all functions)

After JWT validation and before any business logic, add:

```text
1. Extract user from JWT (already done in most functions)
2. Query tenant_members WHERE user_id = caller.id AND tenant_id = requested_tenant_id AND status = 'active'
3. If no membership found -> return 403 Forbidden
4. Proceed with business logic
```

The service-role admin client (already instantiated in each function) performs this check so it bypasses RLS and works reliably.

---

## Functions to Fix (grouped by severity)

### CRITICAL: Zero Authentication (2 functions)
These need both JWT auth AND tenant membership added:

1. **`nbs-exchange-rates/index.ts`** -- Add JWT validation + tenant membership check
2. **`wms-slotting/index.ts`** -- Add JWT validation + tenant membership check

### HIGH: Missing Tenant Membership (11 functions)
These already validate JWT but allow cross-tenant access:

3. **`ai-insights/index.ts`** -- Add membership check after line 30
4. **`ai-assistant/index.ts`** -- Add membership check after JWT validation
5. **`create-notification/index.ts`** -- Add membership check after line 24
6. **`sef-submit/index.ts`** -- Add membership check after line 24
7. **`sef-poll-status/index.ts`** -- Add membership check after line 24
8. **`fiscalize-receipt/index.ts`** -- Add membership check after line 33
9. **`fiscalize-retry-offline/index.ts`** -- Add membership check after line 18
10. **`ebolovanje-submit/index.ts`** -- Add membership check after JWT validation
11. **`eotpremnica-submit/index.ts`** -- Add membership check after JWT validation
12. **`web-sync/index.ts`** -- Add membership check after line 28
13. **`generate-pdf/index.ts`** -- Add membership check to financial report branches (trial_balance, income_statement, balance_sheet, pdv_return, aging_report); invoice branch already has it

### OK: No changes needed (3 functions)
- **`create-tenant`** -- Already checks super_admin role
- **`web-order-import`** -- Webhook with HMAC signature verification (no user session)
- **`company-lookup`** -- Stateless external API lookup, no tenant data accessed

### MEDIUM: Internal event bus (1 function)
- **`process-module-event`** -- Uses internal service secret for function-to-function calls; acceptable pattern, but add tenant scoping validation for the JWT path

---

## Implementation Details

### The membership check block (identical pattern for all)

For functions that already have `const admin = createClient(...serviceRoleKey)`:

```typescript
// Verify tenant membership
const { data: membership } = await admin
  .from("tenant_members")
  .select("id")
  .eq("user_id", caller.id)
  .eq("tenant_id", tenant_id)
  .eq("status", "active")
  .maybeSingle();

if (!membership) {
  return new Response(
    JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### For `nbs-exchange-rates` and `wms-slotting` (zero-auth functions)

These need the full auth block added before business logic:

```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const userClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);
const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
if (authErr || !caller) {
  return new Response(JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
// Then the membership check as above
```

### For `generate-pdf` financial report branches

The invoice branch already checks membership. The fix adds the same check inside `generateTrialBalance`, `generateIncomeStatement`, `generateBalanceSheet`, `generatePdvReturn`, and `generateAgingReport` -- passing the `user` object to each function and checking membership before querying data.

### For `process-module-event` (JWT path only)

When authenticated via JWT (not internal secret), add a check that the user has membership to the tenant associated with the event being processed.

---

## Files Modified

All changes are in `supabase/functions/`:

1. `nbs-exchange-rates/index.ts` -- Add full JWT + membership guard
2. `wms-slotting/index.ts` -- Add full JWT + membership guard
3. `ai-insights/index.ts` -- Add membership guard
4. `ai-assistant/index.ts` -- Add membership guard
5. `create-notification/index.ts` -- Add membership guard
6. `sef-submit/index.ts` -- Add membership guard
7. `sef-poll-status/index.ts` -- Add membership guard
8. `fiscalize-receipt/index.ts` -- Add membership guard
9. `fiscalize-retry-offline/index.ts` -- Add membership guard
10. `ebolovanje-submit/index.ts` -- Add membership guard
11. `eotpremnica-submit/index.ts` -- Add membership guard
12. `web-sync/index.ts` -- Add membership guard
13. `generate-pdf/index.ts` -- Add membership guard to financial report functions
14. `process-module-event/index.ts` -- Add tenant membership check on JWT path

No frontend changes required. All changes are backend security hardening.

---

## Verification

After deployment, every function should:
- Return 401 if no/invalid JWT provided
- Return 403 if valid JWT but user is not an active member of the requested tenant
- Return 200/normal response only for authenticated tenant members



# Fix RLS: `notifications` INSERT Policy with `WITH CHECK(true)`

## Finding

Only **one** problematic write policy was found:

| Table | Policy | Command | Issue |
|---|---|---|---|
| `notifications` | "Service role can insert notifications" | INSERT | `WITH CHECK(true)` applied to `public` role |

This allows **any** user (authenticated or anonymous) to insert notifications targeting any tenant and any user. The policy name suggests it was intended for service-role-only use, but it actually grants unrestricted INSERT access.

The other flagged policy (`module_definitions` SELECT with `USING(true)`) is acceptable -- it's a read-only reference table scoped to `authenticated` with write operations properly gated behind `is_super_admin()`.

All other tenant-scoped tables (companies, contacts, meetings, web_connections, web_prices, etc.) correctly use `get_user_tenant_ids(auth.uid())` for tenant scoping on write operations.

---

## Fix

Replace the overly permissive `notifications` INSERT policy with two policies:

### Policy 1: Users can insert notifications for themselves within their tenants

Users should only be able to create notifications where `user_id = auth.uid()` AND `tenant_id` is one of their active tenants. This supports client-side notification creation (e.g., reminders).

### Policy 2: Service role bypass

Edge functions that create notifications for other users (e.g., `create-notification`, `nbs-exchange-rates` admin alerts) use the service role key, which bypasses RLS entirely. No explicit policy is needed for them -- the service role is exempt from RLS by default in Supabase.

---

## Migration SQL

```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Replace with tenant-scoped, user-scoped insert policy
CREATE POLICY "Users can insert notifications for themselves"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);
```

---

## Technical Details

**Why removing the old policy is safe:**
- Edge functions (`create-notification`, `nbs-exchange-rates`, `process-module-event`) use `SUPABASE_SERVICE_ROLE_KEY` to create their Supabase client, which bypasses RLS completely
- The new policy only affects direct client-side inserts, which should be scoped to the current user anyway
- No frontend code inserts notifications for other users

**What was reviewed and found correct:**
- `ai_conversations` -- scoped by `auth.uid() = user_id AND tenant_id IN get_user_tenant_ids()`
- `audit_log` -- scoped by `tenant_id IN get_user_tenant_ids() OR is_super_admin()`
- `companies`, `contacts`, `meetings` -- scoped by `tenant_id IN get_user_tenant_ids()`
- `notification_preferences` -- scoped by `auth.uid() = user_id`
- `profiles` -- scoped by `id = auth.uid()`
- `sef_submissions` -- scoped by tenant membership subquery
- `web_connections`, `web_price_lists`, `web_prices`, `web_sync_logs` -- scoped by `tenant_id IN get_user_tenant_ids()`
- `module_definitions` -- read `USING(true)` for authenticated (reference table), writes gated by `is_super_admin()`

**Files modified:** One database migration only. No code changes needed.


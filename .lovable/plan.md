

# Fix: Infinite Recursion in `tenant_members` RLS Policy

## Problem

Every module page fails to load because the `useTenant()` hook queries `tenant_members`, which returns a **500 error**:

```
infinite recursion detected in policy for relation "tenant_members"
```

## Root Cause

The RLS policy **"Tenant admins can manage their members"** on `tenant_members` contains a sub-query that reads from `tenant_members` itself:

```sql
EXISTS (
  SELECT 1 FROM tenant_members tm
  WHERE tm.tenant_id = tenant_members.tenant_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
    AND tm.status = 'active'
)
```

When Postgres evaluates this sub-query, it applies RLS policies to the inner `tenant_members` reference too, which triggers the same policy again -- creating infinite recursion.

## Solution

Create a `SECURITY DEFINER` helper function (like the existing `get_user_tenant_ids` and `is_super_admin` functions) that checks admin membership **without** going through RLS. Then update the policy to use this function.

### Database Migration

**Step 1**: Create a helper function `is_tenant_admin(user_id, tenant_id)`:

```sql
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'admin'
      AND status = 'active'
  )
$$;
```

**Step 2**: Replace the recursive policy:

```sql
DROP POLICY "Tenant admins can manage their members" ON public.tenant_members;

CREATE POLICY "Tenant admins can manage their members"
  ON public.tenant_members
  FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id));
```

### No Frontend Changes Required

The fix is entirely in the database. Once the RLS policy is fixed, `useTenant()` will return data successfully and all module pages will load.

## Files to Modify

| File | Changes |
|------|---------|
| Database migration (SQL) | Create `is_tenant_admin()` function; drop and recreate the recursive policy |

No application code changes needed.



# Fix: Show Last Contact Dates in Bulk Email Dialog

## Problem

The "Poslednji kontakt" column shows "—" for all users even though contact data exists in the database. This is because the `email_notification_log` table has an RLS policy that only lets users see their own logs (`user_id = auth.uid()`). The automated trial expiration emails were logged with the system's user ID, not the admin's, so the admin's client-side query returns no matching rows.

## Solution

Add an RLS policy that allows admin users to read all rows in `email_notification_log`.

## Changes

### 1. Database Migration: Add admin read policy

```sql
CREATE POLICY "Admins can view all email logs"
ON email_notification_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
```

This allows users with the `admin` role to see all email notification logs, including automated trial expiration entries. Non-admin users still only see their own logs.

### Files

- **Migration only** -- no code changes needed. The `BulkEmailDialog` query already works correctly; it just needs permission to see the data.




# Make Bogdan a Super Admin

Add the `super_admin` role to user `bogdan@aiitdevelopment.com` (user ID: `7b279f18-57db-4b52-aea5-e0d413a5bdaa`).

## What changes

A single database insert into `user_roles`:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('7b279f18-57db-4b52-aea5-e0d413a5bdaa', 'super_admin');
```

This will give Bogdan access to the Super Admin panel at `/super-admin/dashboard` while keeping his existing `user` role.

## Files

No file changes needed -- this is a database-only operation via migration.


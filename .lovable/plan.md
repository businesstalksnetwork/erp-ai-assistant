

# Remove Admin and Expire Subscription for pbcconsulting021@gmail.com

## What will be done

Two database operations on user `pbcconsulting021@gmail.com` (ID: `8410de73-1e08-472a-b317-071052530b51`):

1. **Remove admin role** -- Delete the row from `user_roles` table
2. **Expire subscription** -- Set `subscription_end` to yesterday (`2026-02-16`) so the account appears expired

## Result

After these changes, logging in as this user will show the expired subscription experience:
- Redirected to Profile page
- All other routes blocked
- Subscription banner showing expiration

## Reverting later

To restore admin access and subscription:
```text
INSERT INTO user_roles (user_id, role) VALUES ('8410de73-...', 'admin');
UPDATE profiles SET subscription_end = '2099-12-31' WHERE email = 'pbcconsulting021@gmail.com';
```

## Technical Details

SQL migration with two statements:
1. `DELETE FROM user_roles WHERE user_id = '8410de73-1e08-472a-b317-071052530b51' AND role = 'admin';`
2. `UPDATE profiles SET subscription_end = '2026-02-16' WHERE id = '8410de73-1e08-472a-b317-071052530b51';`

No code file changes needed.


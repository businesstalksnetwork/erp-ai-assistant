
# Restore Admin + Subscription for pbcconsulting021@gmail.com

## What will be done

Two database operations on user ID `8410de73-1e08-472a-b317-071052530b51`:

1. **Restore admin role** -- Insert back into `user_roles` table with role `admin`
2. **Restore subscription** -- Set `subscription_end` to `2099-12-31`

## Technical Details

```sql
INSERT INTO user_roles (user_id, role) 
VALUES ('8410de73-1e08-472a-b317-071052530b51', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE profiles 
SET subscription_end = '2099-12-31' 
WHERE id = '8410de73-1e08-472a-b317-071052530b51';
```

No code changes needed. After this, log out and back in to see full admin access restored.

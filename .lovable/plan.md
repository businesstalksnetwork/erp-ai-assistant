

# Role-Based Notification Categories

## Problem
Currently all users see the same 5 notification categories (invoice, inventory, approval, hr, accounting) regardless of their role. A `sales` user shouldn't see HR notifications, and an `hr` user shouldn't see accounting notifications. The mapping should also be considered when creating/editing company roles.

## Design

Use the existing `rolePermissions` config to derive which notification categories a role can access. The mapping is straightforward:

```text
Module Group → Notification Category
─────────────────────────────────────
sales, crm    → invoice
inventory     → inventory
*             → approval (everyone gets approvals)
hr            → hr
accounting    → accounting
```

No new DB tables needed — this is a client-side filter plus a backend check.

## Changes

### 1. Create `src/config/roleNotificationCategories.ts`
- Map each `TenantRole` to the notification categories they should see
- Derive from `rolePermissions` module access: if a role has access to `sales` → gets `invoice` category, etc.
- Export a `getNotificationCategoriesForRole(role: TenantRole): string[]` function
- All roles always get `approval` (cross-cutting)

### 2. Update `NotificationPreferences.tsx`
- Import the user's current role from `useTenant()`
- Filter `CATEGORIES` to only show categories relevant to the user's role using `getNotificationCategoriesForRole`
- Admin/manager sees all categories; `hr` role only sees `hr` + `approval`; `sales` sees `invoice` + `approval`, etc.

### 3. Update Edge Function `send-notification-emails/index.ts`
- Before sending any notification, look up the user's `tenant_members.role` for the relevant company
- Check `notification_preferences` for that user+category, respecting per-channel toggles (`in_app_enabled`, `push_enabled`, `email_enabled`)
- Skip sending if the user's role shouldn't receive that category (server-side enforcement)

### 4. Add translations
- Add `roleBasedNotificationsInfo` key: EN = "You only see notification categories relevant to your role", SR = "Prikazane su samo kategorije obaveštenja relevantne za vašu ulogu"


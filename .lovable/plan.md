

# Admin Notification Category Settings per Role

## Overview
Create a new settings page where admins can customize which notification categories each company role receives, overriding the hardcoded defaults in `roleNotificationCategories.ts`. This requires a new DB table and a settings UI.

## Changes

### 1. Database: `role_notification_overrides` table
```sql
CREATE TABLE public.role_notification_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, role, category)
);
-- RLS: tenant members with admin role can read/write
```

### 2. Update `roleNotificationCategories.ts`
- Add an async `getCustomNotificationCategoriesForRole(tenantId, role)` that queries `role_notification_overrides` first
- Falls back to the existing hardcoded logic if no overrides exist
- Export both sync (default) and async (custom) versions

### 3. Update `NotificationPreferences.tsx`
- Fetch overrides from `role_notification_overrides` for the current tenant + role
- Merge with defaults: if overrides exist, use them; otherwise use `getNotificationCategoriesForRole`

### 4. New settings page: `src/pages/tenant/NotificationCategorySettings.tsx`
- Matrix UI: rows = roles (admin, manager, accountant, sales, hr, store, user), columns = categories (invoice, inventory, approval, hr, accounting)
- Each cell is a Checkbox toggling `role_notification_overrides` for that tenant/role/category
- Pre-filled with current defaults from `getNotificationCategoriesForRole`
- Admin-only page

### 5. Route + navigation
- Add route `settings/notification-categories` in `settingsRoutes.tsx`
- Add link in `Settings.tsx` under Operations section with `Bell` icon, label `notificationCategorySettings`

### 6. Translations
- Add keys: `notificationCategorySettings`, `notificationCategorySettingsDesc`, `roleLabel`, and category labels reuse existing keys

### 7. Edge function update
- `send-notification-emails`: query `role_notification_overrides` for the user's role + tenant before falling back to hardcoded logic


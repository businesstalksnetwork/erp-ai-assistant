

# User Profile Page, Header Redesign, and Collapsible Sidebar Modules

## Overview

Three changes in one: (1) a new User Profile page, (2) move logout + profile access to a user dropdown in the header, and (3) make sidebar module groups collapsible.

---

## 1. User Profile Page

Create a new page at `/profile` where users can:

- **View/edit display name** -- updates `auth.users` metadata via `supabase.auth.updateUser()`
- **Change password** -- uses `supabase.auth.updateUser({ password })` with current password confirmation
- **Manage notification preferences** -- reuses the existing `NotificationPreferences` component
- **View account info** -- email (read-only), role, tenant name

### File: `src/pages/tenant/Profile.tsx`

Sections:
- Account info card (email, role, tenant)
- Display name form with save button
- Password change form (new password + confirm)
- Notification preferences (embedded `NotificationPreferences` component)

---

## 2. Header User Menu (Right Side)

Replace the current sidebar logout button with a user avatar/dropdown in the header's right side.

### Changes to `src/layouts/TenantLayout.tsx`:

**Header (right side) -- add a `DropdownMenu` with:**
- User avatar (initials circle) + display name
- "Profile" link -> navigates to `/profile`
- "Super Admin" link (if `isSuperAdmin`)
- Divider
- "Logout" button

**Sidebar footer -- remove** the logout button entirely.

The header right side will contain: Super Admin button (if applicable) | Notification bell | Language toggle | **User dropdown**

---

## 3. Collapsible Sidebar Module Groups

Make each sidebar group (CRM, Purchasing, HR, Inventory, Accounting, etc.) collapsible using the `Collapsible` component from Radix UI (already installed).

### Changes to `src/layouts/TenantLayout.tsx`:

- Wrap each `SidebarGroup` content in `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent`
- The group label becomes the trigger with a chevron icon that rotates on open/close
- Groups that contain the currently active route default to open
- All other groups default to collapsed
- Dashboard and single-item groups (Documents, Returns) stay always visible (not collapsible)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/Profile.tsx` | User profile page with display name, password change, and notification preferences |

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Remove sidebar logout; add user dropdown to header; wrap nav groups in Collapsible |
| `src/App.tsx` | Add `/profile` route inside tenant layout |
| `src/i18n/translations.ts` | Add keys: profile, displayName, changePassword, currentPassword, newPassword, confirmPassword, passwordChanged, profileUpdated, myAccount |

---

## Technical Details

### User Dropdown Component (inline in TenantLayout)

Uses `DropdownMenu` from shadcn/ui with:
- Trigger: a circular avatar showing user initials (from email or display name) 
- Menu items: Profile, Super Admin (conditional), separator, Logout
- Background: `bg-popover` with proper z-index (already handled by Radix)

### Collapsible Groups

Each module group wraps its content in:

```text
<Collapsible defaultOpen={groupContainsActiveRoute}>
  <CollapsibleTrigger> Group Label + ChevronDown </CollapsibleTrigger>
  <CollapsibleContent> SidebarMenu items </CollapsibleContent>
</Collapsible>
```

Uses `useLocation()` to check if any item URL in the group matches the current path, setting `defaultOpen` accordingly.

### Profile Page Password Change

- Two fields: new password + confirm password
- Client-side validation: minimum 6 characters, passwords must match
- Calls `supabase.auth.updateUser({ password: newPassword })`
- Shows success toast on completion

### Display Name Update

- Single input field pre-filled from `user.user_metadata.full_name` or `user.user_metadata.display_name`
- Calls `supabase.auth.updateUser({ data: { full_name: value } })`
- Shows success toast


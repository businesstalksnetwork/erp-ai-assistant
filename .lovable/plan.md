
# Remove User Profile Section from Sidebar

## Change

Remove the user profile/avatar section at the bottom of the sidebar (lines 435-475 in `TenantLayout.tsx`). This includes the avatar, name, role display, and the dropdown menu with profile/language/logout options.

The logout and language toggle functionality will remain accessible through the top header bar (where they already exist), so no functionality is lost.

## Technical Details

**File: `src/layouts/TenantLayout.tsx`**

- Delete the entire user profile `<div>` block (lines 436-474) inside `SidebarFooter`, which contains the `Avatar`, `DropdownMenu`, and all its menu items
- Remove the `border-t` from the wrapper since Settings group already has border handling
- Clean up any unused imports that were only used by this section (`Avatar`, `AvatarFallback`, `ChevronDown`, `User`, `LogOut`, `DropdownMenu*`) -- only if not used elsewhere in the file
- Remove the `userInitials`, `userName`, `userRole` derived variables if no longer referenced

One file modified: `src/layouts/TenantLayout.tsx`

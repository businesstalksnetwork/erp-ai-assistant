

# Fix: Remove White Divider and Sidebar Scroll

## Issues
1. A visible white/light separator line appears between the Dashboard item and the module groups (line 372 in `TenantLayout.tsx`)
2. The sidebar shows a scrollbar due to `overflow-y-auto` on `SidebarContent`

## Changes

**File: `src/layouts/TenantLayout.tsx`**

1. **Remove the Separator** -- Delete the `<Separator className="mx-3 my-1 opacity-50" />` on line 372 entirely. The spacing between Dashboard and the collapsible groups is sufficient without it.

2. **Remove scroll from sidebar content** -- Change `SidebarContent` class from `overflow-y-auto` to `overflow-hidden`. Since all module groups are collapsible and collapsed by default (only the active one opens), scrolling should not be needed. The sidebar should fit its content without a scrollbar.

Only 1 file modified: `src/layouts/TenantLayout.tsx` (2 small edits).


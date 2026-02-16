

# Fix Settings ("Podesavanja") Sidebar Expand Bug

## Problem

The Settings menu is placed inside `SidebarFooter`, which is pinned to the bottom of the sidebar. When you click to expand it, the collapsible content tries to grow upward but the trigger button stays fixed in place, causing the menu options to overlap or shift incorrectly.

## Solution

Move the Settings group from `SidebarFooter` into the main `SidebarContent` area (after DMS). This way, when Settings expands, it scrolls naturally within the sidebar's scrollable content area -- just like every other menu group.

The `SidebarFooter` will be removed since it no longer has content.

## Technical Detail

**File: `src/layouts/TenantLayout.tsx`**

1. Move the Settings `CollapsibleNavGroup` block (lines 414-434) into `SidebarContent`, placing it after the Documents (DMS) group (after line 409)
2. Remove the now-empty `SidebarFooter` wrapper (lines 413-435)

This is a simple cut-and-paste of ~20 lines with no logic changes. The Settings section becomes the last item in the scrollable sidebar, expanding and collapsing naturally like all other groups.


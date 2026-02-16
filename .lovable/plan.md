

# Plan: Mobile header logo fix + hamburger menu to "Vise" toggle

## Changes in `src/components/AppLayout.tsx`

### 1. Mobile header - always use dark logo
The current code uses `logoLightSidebar` in light mode, which has poor contrast on the white mobile header background. Change to always use `logoDark` in the mobile header (line 182), regardless of theme.

### 2. Remove hamburger menu from mobile header
Remove the hamburger `Menu`/`X` button from the mobile header (lines 186-194). The header will only show logo + NotificationBell.

### 3. "Vise" button toggles sidebar open/close
Change the "Vise" button in the bottom nav (lines 414-420) from `onClick={() => setMobileMenuOpen(true)}` to `onClick={() => setMobileMenuOpen(!mobileMenuOpen)}` so pressing it again closes the sidebar.

## Files changed

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | (1) Use `logoDark` always in mobile header, (2) remove hamburger button, (3) toggle sidebar on "Vise" press |


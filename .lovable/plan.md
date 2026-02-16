

# Scrollable Sidebar with Custom Styled Scrollbars

## Problem
The sidebar was set to `overflow-hidden` which cuts off content when groups are expanded. Scrollbars across the app use browser defaults which look out of place in the dark professional theme.

## Changes

### 1. Re-enable sidebar scrolling (`src/layouts/TenantLayout.tsx`)
- Change `SidebarContent` class from `overflow-hidden` back to `overflow-y-auto`
- Add the custom scrollbar CSS class to the element

### 2. Add global custom scrollbar styles (`src/index.css`)
Add CSS for styled scrollbars that match the dark professional design:

- **Thin scrollbar track**: transparent or near-invisible background
- **Scrollbar thumb**: uses `--sidebar-border` color in sidebar context, `--border` color elsewhere
- **Hover state**: slightly brighter thumb on hover
- **Width**: 4px for sidebar, 6px for general content areas
- **Border-radius**: fully rounded for a modern look

Specific CSS additions:
- `.custom-scrollbar` utility class for the sidebar (4px thin, sidebar-colored)
- Global `::-webkit-scrollbar` styles for all scrollable areas (6px, subtle border-colored)
- Firefox support via `scrollbar-width: thin` and `scrollbar-color`
- Both light and dark mode variants using the existing CSS variables

### File Summary
- `src/index.css` -- Add custom scrollbar CSS rules
- `src/layouts/TenantLayout.tsx` -- Change `overflow-hidden` to `overflow-y-auto` and add scrollbar class




# Sidebar Readability & Width Improvement

## Problem

The sidebar is too narrow and all text is too small. Module categories (CRM, Prodaja, POS, Magacin, etc.) look identical to sub-items -- small 11px text at 50% opacity. Everything blends together, making it hard to scan and navigate.

---

## Changes (all in `src/layouts/TenantLayout.tsx`)

### 1. Increase Sidebar Width
- Change from `w-60` (240px) to `w-64` (256px) for more breathing room

### 2. Module Category Triggers (CollapsibleNavGroup)
Make them visually distinct from sub-items:
- Text size: `11px` -> `14px`
- Opacity: `50%` -> `90%` (near full visibility)
- Font weight: `font-medium` -> `font-semibold`
- Icon size: `h-3.5 w-3.5` -> `h-4.5 w-4.5` with higher opacity
- Padding: `py-1.5` -> `py-2.5` (more vertical space)
- Add `mt-2` for spacing between groups
- Chevron: increase to `h-3.5 w-3.5` with higher opacity

### 3. Nav Items (sub-items within groups)
- Text size: `13px` -> `14px` for better readability
- Padding: `py-1.5` -> `py-2` (larger touch targets)
- Icon size stays `h-4 w-4`

### 4. Sub-section Labels
- Text size: `10px` -> `11px`
- Opacity: `30%` -> `40%`

### 5. Dashboard Nav Item
- Same text/padding increase as nav items: `13px` -> `14px`, `py-1.5` -> `py-2`

### 6. Settings Footer Trigger
- Apply same styling as module category triggers (14px, semibold, 90% opacity)

### 7. Logo Area
- Logo text: `text-sm` -> `text-base` for consistency with larger sidebar
- Subtitle: `10px` -> `11px`

---

## Visual Result

**Before:** Everything is tiny 11-13px text, categories and items look the same
**After:** Module categories are bold 14px headers that stand out clearly; sub-items are comfortable 14px but lighter weight; clear visual hierarchy between the three levels

---

## Scope
- Single file: `src/layouts/TenantLayout.tsx`
- Pure styling changes (Tailwind classes only)
- No logic, routing, or data changes


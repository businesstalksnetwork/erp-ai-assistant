

## Sidebar Logo Spacing and Font Size Updates

### Changes in `src/layouts/TenantLayout.tsx`

**1. Logo margins** (line 321):
- Change `pt-2 pb-5` to `pt-6 pb-8` to add more vertical breathing room above and below the logo.

**2. "Kontrolna tabla" and "Brzi AI Izvestaj" font size** (line 338):
- Change `text-[14px]` to `text-[15px]` and add `font-medium` for the mainNav items (Dashboard and AI Briefing) to make them stand out more from the collapsible group items.
- Increase icon size from `h-4 w-4` to `h-5 w-5` for these top-level items to match the larger text.

### Files to modify

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Increase logo container padding (`pt-6 pb-8`), increase mainNav item font to `text-[15px] font-medium`, bump icons to `h-5 w-5` |


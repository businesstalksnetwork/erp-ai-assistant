

# UI Improvements: Profile Tabs, Companies Header, Bookkeeper Section, Invoice Detail Top

## 1. Profile Page - Show tab names on mobile

Currently, tab labels are hidden on mobile (`hidden sm:inline`), showing only icons. Change to always show tab names so users know which tab is selected.

### File: `src/pages/Profile.tsx` (lines 325-348)
- Remove `hidden sm:inline` from all `<span>` elements inside `TabsTrigger` so tab names are always visible on all screen sizes.

## 2. Profile Page - Make content wider

Currently uses `container mx-auto` which constrains width.

### File: `src/pages/Profile.tsx` (line 315)
- Change `container mx-auto py-6` to a wider layout, e.g., `max-w-5xl mx-auto py-6 px-4` to give more breathing room.

## 3. Companies Page - Hide "Dodaj kompaniju" button when a company exists (single company scenario)

Currently the button always shows if `canAddCompany` is true. Hide it when user already has a company and `maxCompanies` is 1 (single company limit).

### File: `src/pages/Companies.tsx` (line 1232)
- Change the condition from `canAddCompany` to `canAddCompany && (myCompanies.length === 0 || hasMultipleCompanies)` so the button is hidden when a single company already exists and the user's limit is 1.

## 4. Companies Page - Redesign "Pozovi knjigovodju" section

The current bookkeeper tab has a redundant layout with both a status card and a separate action card. Simplify into a cleaner, more compact design.

### File: `src/pages/Companies.tsx` (lines 792-912)
- Merge the status indicator and action into a single clean card
- When no bookkeeper: show a simple message with an inline invite button (no separate bordered row)
- When pending/accepted: show status with action buttons directly, without nested cards
- Remove the extra bordered `div` wrapping the action area

## 5. Invoice Detail - Redesign top action bar on mobile

From the screenshot, on mobile the buttons stack awkwardly. Reorganize for better mobile UX.

### File: `src/pages/InvoiceDetail.tsx` (lines 449-498)
- On mobile: place "Vrati se nazad" button on top, then action buttons below in a cleaner row
- Make buttons stack vertically on mobile with consistent full-width styling
- Ensure "Preuzmi PDF" and "Posalji klijentu" are prominent, "Napravi sablon" is secondary


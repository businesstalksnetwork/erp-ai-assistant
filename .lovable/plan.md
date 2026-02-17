

# Fix Scroll and Add Sorting by Last Contact Date

## Problems
1. The ScrollArea still doesn't scroll -- all 11 rows are visible but the dialog extends beyond the viewport
2. No ability to sort by "Poslednji kontakt" column

## Solution

### File: `src/components/BulkEmailDialog.tsx`

**Fix scroll**: Replace the Radix `ScrollArea` with a plain `div` using `overflow-y-auto` and a fixed `max-h`. The Radix ScrollArea has issues with table layouts where it doesn't properly constrain the content height.

**Add sorting**: Add a clickable "Poslednji kontakt" header that toggles between ascending/descending sort order. Default sort: most recently contacted first (descending). Users without contact dates sort to the bottom.

### Changes
- Replace `<ScrollArea>` with `<div className="overflow-y-auto max-h-[45vh] border rounded-md">`
- Add `sortOrder` state (`'asc' | 'desc'`) defaulting to `'desc'`
- Make the "Poslednji kontakt" table header clickable with a sort icon (ArrowUpDown from lucide)
- Sort the users list using `useMemo` based on `lastContactMap` values and current sort order
- Users with no contact date always appear at the bottom regardless of sort direction


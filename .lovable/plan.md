
# Fix Invoice Preview Mobile Layout

## Problems (from screenshots)
1. Items table columns overflow -- "Ukupno" column is cut off on the right
2. "ZA PLAĆANJE" dark box overflows past the card edge
3. QR code and total amount are side-by-side (`flex justify-between`) which doesn't fit on mobile
4. Email history row is too tight -- email address truncated and badge cramped

## Solution

### File: `src/pages/InvoiceDetail.tsx`

**1. Items table (lines 637-670)** -- Make the table horizontally scrollable on mobile:
- Wrap the table in `overflow-x-auto` div
- Reduce cell padding on mobile: `p-3` to `p-2` on small screens
- Reduce fixed column widths on mobile

**2. QR + Total section (lines 684-790)** -- Stack vertically on mobile:
- Change `flex justify-between items-end gap-4` to `flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4`
- Remove `min-w-[280px]` on mobile: change to `sm:min-w-[280px] w-full`
- This ensures QR code appears above the total on small screens

**3. Email history (lines 512-533)** -- Improve mobile layout:
- Change the inner row from horizontal to wrapping: add `flex-wrap` or stack on mobile
- Increase `max-w-[200px]` truncation or make it responsive

**4. Issuer/Recipient grid (line 586)** -- Stack on mobile:
- Change `grid grid-cols-2 gap-6` to `grid grid-cols-1 sm:grid-cols-2 gap-6` so issuer and recipient stack vertically on narrow screens

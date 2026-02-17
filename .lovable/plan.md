

# Wider Layouts + Mobile Chart Fix

## 1. Documents page - Remove extra padding to match Clients

The Documents page wraps content in `<div className="p-6 space-y-6">` but the AppLayout already adds `p-4 lg:p-8`. This double padding makes it narrower than Clients. 

### File: `src/pages/Documents.tsx`
- Line 243: Change `p-6 space-y-6` to `space-y-4 sm:space-y-6` (remove the extra p-6)
- Line 230 (no company state): Change `p-6` to remove padding

## 2. Service Catalog page - Same fix

### File: `src/pages/ServiceCatalog.tsx`
- Line 117: Change `p-6 space-y-6` to `space-y-4 sm:space-y-6`
- Line 106 (no company state): Change `p-6` to remove padding

## 3. Invoice Analytics - Fix chart overflow on mobile

The charts overflow the screen on mobile. The main issues:
- LineChart has `margin={{ left: 20, right: 30 }}` which pushes content wider
- The `lg:grid-cols-2` grid puts charts side-by-side only on large screens (good), but charts themselves overflow on small screens
- The wrapper `space-y-6` root div needs `overflow-x-hidden`

### File: `src/pages/InvoiceAnalytics.tsx`
- Line 207: Add `overflow-x-hidden` to root div: `space-y-6 overflow-x-hidden`
- Line 283: Reduce chart margins on mobile -- change `margin={{ top: 20, right: 30, left: 20, bottom: 5 }}` to `margin={{ top: 10, right: 10, left: 0, bottom: 5 }}`
- Line 282: The ChartContainer is fine with `w-full`, but ensure `min-w-0` is added to prevent flex overflow
- Line 286: Reduce YAxis width -- add `width={40}` to YAxis
- Line 319: Add `min-w-0` to the pie chart wrapper div
- Line 341: Make the legend items wrap on mobile -- add `flex-wrap` to the legend div



# Fix Analytics Page - Complete Mobile Fit

## Problems (from screenshots)
1. **Line chart cut off at August** -- only 8 of 12 months visible. The chart renders wider than the container and `overflow-x-hidden` on the root div clips the right side silently.
2. **Pie chart legend clipped** -- the "Nenaplaceno" legend item at the bottom is partially hidden by the card boundary.
3. **Cards not edge-to-edge** -- blocks appear to have uneven spacing or don't fill the viewport properly.

## Root Cause
The line chart's Recharts `LineChart` renders all 12 data points but the chart's internal layout (YAxis width=45 + margins + dot sizes) pushes content beyond the container. With `overflow-x-hidden` on the parent, the excess is silently clipped instead of scrolling.

## Solution - All in `src/pages/InvoiceAnalytics.tsx`

### 1. Line chart: compress to fit mobile width natively
- Reduce `YAxis width` from `45` to `35` on mobile (saves 10px)
- Reduce `margin.right` from `10` to `5` and `margin.left` from `0` to `-5` on mobile
- Reduce dot radius from `r: 4` to `r: 2` on mobile (dots at 12 months overlap at r:4)
- Remove the `Legend` component on mobile (it takes vertical space and the label "Promet" is redundant when there's only one line)
- These changes recover ~30px of horizontal space, enough to fit all 12 months

### 2. Pie chart legend: ensure fully visible
- The legend `div` with `pb-4` is still clipped by the Card. Add `overflow-visible` to the CardContent or move the legend outside the constrained height area
- Actually the issue is that the pie chart `div` has fixed `h-[250px]` and the legend sits below it but the CardContent clips. Simply ensure the legend is part of the normal flow (it already is) -- the real fix is the Card's `overflow` which is default `visible`. The clipping comes from the page-level `overflow-x-hidden`. Since we keep that, we need to ensure the legend doesn't extend horizontally. Use `formatShortCurrency` (already done) for legend values to keep them short.

### 3. Cards not filling width / "no endings on right"
- The page padding `p-4` from AppLayout is fine. The issue is likely the `overflow-x-hidden` causing visual clipping of card shadows/borders on the right edge.
- Add `px-1` inner padding to the root div so card shadows don't get clipped: change `<div className="space-y-6 overflow-x-hidden">` to `<div className="space-y-6 overflow-x-hidden px-1">`

## Technical Changes

```text
File: src/pages/InvoiceAnalytics.tsx

Line 209: Add px-1 to root div for card edge breathing room
Line 285: Use isMobile conditional for LineChart margins  
Line 287: Reduce XAxis tick fontSize to 8 on mobile
Line 288: Reduce YAxis width to 35 on mobile
Line 293: Conditionally hide Legend on mobile
Line 300: Reduce dot r to 2 on mobile
Line 348: Use formatShortCurrency for pie legend values on mobile
```

All changes are in a single file and ensure every element fits within the mobile viewport without horizontal scrolling.

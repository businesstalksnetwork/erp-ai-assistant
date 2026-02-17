

# Fix Analytics Page - Complete Mobile Overhaul

## Root Cause

Removing `overflow-x-hidden` from the page root caused the entire page to scroll horizontally. The `min-w-[600px]` on the line chart pushes the viewport wider, breaking ALL content below it (pie chart shifted, tables overflowing, dark background visible).

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**1. Add `overflow-x-hidden` BACK to root div (line 209)**

This prevents the entire page from scrolling horizontally. The line chart's internal `overflow-x-auto` wrapper will still allow horizontal scrolling within the chart card only.

**2. Line chart (lines 284-306) -- already correct**

The `overflow-x-auto` wrapper with `min-w-[600px]` works perfectly inside an `overflow-x-hidden` parent. Users scroll only the chart area, not the whole page.

**3. Pie chart (lines 312-356) -- fix label clipping**

The pie chart labels ("Naplaceno 56%") extend beyond the card boundary, which gets clipped by `overflow-hidden`. Fix:
- Remove `overflow-hidden` from the Card
- On mobile: show only percentage in labels (no text), reduce outerRadius to 65, shift cx to "40%"
- This keeps labels inside the card bounds without clipping
- Reduce the chart container height on mobile from 300px to 250px to eliminate the huge white space

**4. Top 5 tables (lines 360-431) -- fix amount truncation**

The amounts ("1.097.559 RSD") get cut off because the flex row doesn't constrain the partner name enough. Fix:
- Add `max-w-[55%]` to the name container so the amount always has room
- Keep `truncate` on partner name text
- This ensures amounts are always fully visible

### Technical changes

```
Line 209: <div className="space-y-6 overflow-x-hidden">

Line 312: Remove overflow-hidden from Card (back to just <Card>)
Line 323: h-[250px] sm:h-[300px] (reduce mobile height)
Line 328: cx={isMobile ? "40%" : "50%"}
Line 331: outerRadius={isMobile ? 65 : 100}

Line 376: <div className="flex items-center gap-3 min-w-0 max-w-[55%]">
Line 413: <div className="flex items-center gap-3 min-w-0 max-w-[55%]">
```

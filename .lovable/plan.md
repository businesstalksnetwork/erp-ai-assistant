

# Fix Analytics Charts - Root Cause Found

## The Real Problem

Line 209 of `InvoiceAnalytics.tsx` has `overflow-x-hidden` on the page's root container. This clips EVERYTHING -- the line chart's horizontal scroll doesn't work (months cut off), and the pie chart labels get chopped on the right side.

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**1. Remove `overflow-x-hidden` from root div (line 209)**
Change `<div className="space-y-6 overflow-x-hidden">` to `<div className="space-y-6">`. The individual chart sections already handle their own overflow.

**2. Pie chart: prevent label overflow without clipping**
The pie chart's percentage labels extend beyond the container on the right. Fix by:
- Shifting the pie center from `cx="50%"` to `cx="45%"` on mobile to give labels room on the right
- Reducing outer radius further on mobile (from 75 to 70) so labels stay within bounds
- Adding `overflow-hidden` only on the pie chart Card, not the whole page

**3. Line chart: already correct**
The `overflow-x-auto` wrapper with `min-w-[600px]` will work correctly once the parent `overflow-x-hidden` is removed. Users can scroll horizontally to see all 12 months.

### Technical summary

```text
Line 209: Remove overflow-x-hidden from root div
Line 328: cx={isMobile ? "45%" : "50%"}
Line 331: outerRadius={isMobile ? 70 : 100}
Line 312: Add overflow-hidden to pie chart Card
```

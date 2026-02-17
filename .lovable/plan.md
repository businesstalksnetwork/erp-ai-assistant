

# Fix Analytics Page - Make Everything Fit on Mobile (No Scroll)

## Problems from screenshots
1. Line chart only shows 6 months (Jan-Jun) - the min-w + overflow-x-auto approach fails because the parent overflow-x-hidden clips it
2. Pie chart legend at bottom is cut off (only partial dot visible)
3. Top 5 table amounts truncated: "1.097.5" instead of "1.097.559 RSD"

## Root cause
Using `min-w-[600px]` with `overflow-x-auto` inside `overflow-x-hidden` does NOT create a scrollable area - the parent clips everything. The chart must fit within the screen width naturally.

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**1. Line chart - remove min-width, make fully responsive**
- Remove `min-w-[600px]` from ChartContainer (line 285)
- Remove the `overflow-x-auto -mx-2 px-2` wrapper div (line 284) - no longer needed
- Let Recharts handle all 12 months at whatever width is available
- Add `interval={0}` is already set so all months will show as compressed labels
- Reduce XAxis tick fontSize to 9 on mobile for fitting

**2. Pie chart legend - fully visible**
- Increase bottom padding on the legend from `pb-2` to `pb-4` (line 345)
- The legend items are being clipped at the card boundary

**3. Tables - use short currency format on mobile**
- Create a mobile-friendly format that drops "RSD" suffix and uses compact numbers
- Change formatCurrency calls in the table rows to use `formatShortCurrency` on mobile
- This ensures amounts like "1.097.559" fit without truncation
- Add the `isMobile` check to show shorter format: "1.098k" on mobile vs full "1.097.559 RSD" on desktop

## Technical changes

```text
Line 14: Add formatCompact helper for mobile table amounts
Line 284: Remove overflow-x-auto wrapper div
Line 285: Remove min-w-[600px], keep h-[250px] sm:h-[300px] w-full
Line 288: Reduce mobile tick fontSize to 9
Line 306: Remove closing div of wrapper
Line 345: Change pb-2 to pb-4
Line 390: Use formatShortCurrency on mobile for revenue amounts  
Line 422: Use formatShortCurrency on mobile for unpaid amounts
```

All changes are in a single file. The charts and tables will fit natively within the mobile viewport width without any horizontal scrolling.


# Fix Analytics Charts and Tables on Mobile

## Problems
1. Line chart still only shows ~7 months (Jan-Jul), remaining months cut off despite `min-w-[500px]`
2. Top 5 partner tables: names and currency amounts overflow/truncate on mobile
3. Pie chart legend: second item (Nenaplaceno) cut off at bottom

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**1. Line chart -- increase minimum width**
The `min-w-[500px]` is not enough for 12 months with Y-axis labels. Increase to `min-w-[600px]` to ensure all months render. The `overflow-x-auto` wrapper already enables horizontal scrolling.

- Line 285: Change `min-w-[500px]` to `min-w-[600px]`

**2. Top 5 partner tables -- fix overflow on mobile**

Revenue list (lines 375-391):
- Add `gap-2` between name and amount, keep `min-w-0` on name container
- Add `ml-2 text-sm` to the amount `span` to prevent it from being pushed off screen

Unpaid list (lines 412-425):
- Same treatment: add `ml-2 text-sm` to the destructive amount span

Both card titles (lines 364, 401):
- Add `text-base sm:text-lg` to `CardTitle` to prevent title truncation on mobile

**3. Pie chart legend visibility**
The legend `flex-col` layout is fine but ensure both items are visible. Add `pb-2` to give bottom breathing room.

- Line 345: Add `pb-2` to the legend container

### Technical summary

```
Line 285: min-w-[500px] -> min-w-[600px]
Line 364: CardTitle add text-base sm:text-lg
Line 390: amount span add "ml-2 text-sm sm:text-base"
Line 401: CardTitle add text-base sm:text-lg  
Line 422: destructive amount span add "ml-2 text-sm sm:text-base"
Line 345: legend div add pb-2
```

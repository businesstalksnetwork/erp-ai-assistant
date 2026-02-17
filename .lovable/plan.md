

# Fix Cut-off Charts & Admin Panel Scroll

## Problems
1. **Line chart**: Only shows Jan-Aug, months Sep-Dec are cut off on the right side
2. **Pie chart**: Label text "Nenaplaćeno" is truncated to "Nenaplaće" because it overflows the container
3. **Admin panel**: Has unwanted horizontal scrollbar on mobile

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**Line chart fix (around line 282-301):**
- The `ChartContainer` constrains the chart but the 12 month labels overflow. Add `interval={0}` to XAxis to force showing all ticks
- Reduce XAxis font size on mobile and angle labels slightly to fit all 12 months
- Add `tick={{ fontSize: 10 }}` to XAxis

**Pie chart fix (around line 322-335):**
- Reduce `outerRadius` from `100` to `80` on mobile to leave room for labels
- Use shorter label format: show just percentage, not full name (move names to the legend below which already exists)
- Or use `labelLine={false}` and position labels inside
- Best approach: use `useIsMobile` to conditionally reduce radii and simplify labels on mobile

**Specific changes:**
1. Import `useIsMobile` hook
2. Line chart: add `interval={0}` to XAxis, reduce tick font size to 10
3. Pie chart: reduce `innerRadius` to `45`/`outerRadius` to `75` on mobile, shorten label to just percentage on mobile

### File: `src/pages/AdminPanel.tsx`

**Admin panel scroll fix (line 808):**
- Change `<div className="space-y-6 animate-fade-in">` to `<div className="space-y-6 animate-fade-in overflow-x-hidden">`
- This prevents any wide tables or content from causing horizontal scroll on the entire page

## Technical Details

```text
InvoiceAnalytics.tsx changes:
  - Import useIsMobile
  - XAxis: add interval={0}, tick={{ fontSize: isMobile ? 9 : 12 }}
  - Pie: outerRadius={isMobile ? 75 : 100}, innerRadius={isMobile ? 45 : 60}
  - Pie label: on mobile show only percentage, on desktop show name+percentage

AdminPanel.tsx changes:
  - Line 808: add overflow-x-hidden to root div
```

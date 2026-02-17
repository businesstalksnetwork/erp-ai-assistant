

# Fix Analytics Charts on Mobile

## Problems identified from screenshots
1. **Line chart Y-axis is garbled** -- values show in wrong order (300k, 300k, 400k, 200k instead of increasing). This is caused by the chart being too compressed horizontally with `width={35}` on YAxis
2. **Line chart months cut off** -- only shows Jan through Aug, Sep-Dec missing
3. **Pie chart legend cut off** -- "Nenaplaćen..." text truncated on right side

## Root cause
The `ChartContainer` component from shadcn/ui already wraps content in a `ResponsiveContainer`. The line chart inside it is too constrained, causing the Y-axis to overlap and months to be cut off.

## Solution

### File: `src/pages/InvoiceAnalytics.tsx`

**1. Line chart -- make it horizontally scrollable on mobile instead of compressing:**
- Wrap the ChartContainer in an `overflow-x-auto` div
- Give the chart a `min-w-[500px]` so all 12 months are always visible
- Remove the aggressive width reduction on YAxis (back to `width={45}`)
- This approach lets users scroll the chart horizontally on mobile rather than seeing a broken compressed version

**2. Pie chart legend -- prevent text truncation:**
- Change the legend layout from horizontal `flex` row to vertical stack on mobile: `flex-col sm:flex-row`
- Ensure the full text "Nenaplaćeno: XXX RSD" is visible
- Reduce font size on mobile: `text-xs sm:text-sm`

### Technical details

```
Line chart section (~line 284):
- Wrap ChartContainer in: <div className="overflow-x-auto -mx-2 px-2">
- Change ChartContainer className to: "h-[250px] sm:h-[300px] min-w-[500px] w-full"
- YAxis width back to 45

Pie chart legend (~line 343):
- Change flex classes to: "flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-6 mt-4"
- Change span text size: "text-xs sm:text-sm text-muted-foreground"
```

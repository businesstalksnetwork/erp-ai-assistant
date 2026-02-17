

# Fix Analytics Page - Cards & Charts Fully Visible on Mobile

## Problems (from screenshots)

1. **Line chart cut off at August** -- only 8 of 12 months visible. The `overflow-x-hidden` on the parent clips the chart's right side.
2. **Y-axis labels show just "k"** -- the `width={35}` is too narrow to render labels like "400k", so the number gets cut off and only "k" is visible.
3. **Summary cards not same height** -- the three cards (Ukupan promet, Naplaceno, Nenaplaceno) have varying heights because content length differs.
4. **Pie chart legend partially clipped** at the bottom of its card.

## Solution (single file: `src/pages/InvoiceAnalytics.tsx`)

### 1. Line chart: show all 12 months
- Change XAxis `interval` from `0` (force all labels) to `1` on mobile (show every other month: Jan, Mar, Maj, Jul, Sep, Nov). This halves the label count and gives the chart room to render all data points.
- Increase YAxis `width` back to `40` on mobile so labels like "400k" fit.
- Adjust left margin from `-20` to `-10` so the Y-axis labels aren't clipped.

### 2. Cards equal height
- Add `h-full` to each summary Card so the grid equalizes their heights.

### 3. Pie chart: fully visible
- Reduce pie chart container height on mobile from `h-[250px]` to `h-[220px]` to leave room for the legend below.
- Reduce outer radius from `65` to `60` on mobile.

### 4. Page container
- Keep `overflow-x-hidden px-1` as-is (already added in previous fix).

## Technical Details

All changes are in `src/pages/InvoiceAnalytics.tsx`:

| Line | Change |
|------|--------|
| 230 | Add `h-full` to each of the 3 summary `Card` components |
| 285 | Change mobile left margin from `-20` to `-10` |
| 287 | Change XAxis `interval` from `{0}` to `{isMobile ? 1 : 0}` |
| 288 | Change YAxis mobile width from `35` to `40` |
| 321 | Change mobile pie container height from `h-[250px]` to `h-[220px]` |
| 328-329 | Reduce mobile innerRadius to `35`, outerRadius to `58` |


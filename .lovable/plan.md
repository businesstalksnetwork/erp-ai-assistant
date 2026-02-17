

# Fix Analytics Page Mobile Layout - Complete Overhaul

## Problems Identified (from live testing)

1. **Y-axis labels cut off**: Shows "00k" instead of "700k" -- the negative left margin (-10) clips the label text
2. **Line chart cut off on right**: Only months Jan through Jul visible, Sep/Nov missing entirely
3. **Partner revenue amounts truncated**: Numbers like "1.1M" and "132k" cut off on right edge
4. **Pie chart title truncated**: "Naplaceno / Nenaplacen" cuts off the last letter

## Root Cause

The combination of `overflow-x-hidden` on the parent container, negative left margin on the chart, and insufficient Y-axis width causes the chart to clip on both left (labels) and right (data points).

## Solution (single file: `src/pages/InvoiceAnalytics.tsx`)

### 1. Fix Y-axis and line chart visibility
- Remove negative left margin entirely (change from `-10` to `5`)
- Keep YAxis width at `40` (sufficient once margin isn't clipping)
- Change right margin from `5` to `10` to ensure last months render
- These changes ensure all 12 months of data and all Y-axis labels are fully visible

### 2. Fix partner amounts truncation
- Change partner name container from `max-w-[55%]` to `max-w-[50%]` to give more room for amounts
- Ensure amounts always use `formatShortCurrency` on mobile (already in place)

### 3. Fix pie chart title
- Add `text-sm` class to pie chart CardTitle on mobile to prevent text overflow
- Wrap with `truncate` is not needed since the text should fit at smaller size

## Technical Changes

| Area | Line(s) | Change |
|------|---------|--------|
| Line chart margins | 285 | Mobile left margin: `-10` to `5`, right: `5` to `10` |
| Partner revenue max-width | 374, 411 | `max-w-[55%]` to `max-w-[50%]` |
| Pie chart title | 312 | Add responsive text size class |


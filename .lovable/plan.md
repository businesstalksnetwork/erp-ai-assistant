
# Fix: Missing Chart Color Variables

## Problem
The redesign updated all chart components to use `hsl(var(--chart-1))` through `hsl(var(--chart-5))` color variables, but these variables were **never added** to `src/index.css`. When a CSS variable is undefined, `hsl(var(--chart-1))` resolves to an invalid value, which browsers fall back to black. This is why every chart (bars, pie slices, areas) appears as solid black with no color differentiation.

## Solution
Add `--chart-1` through `--chart-5` CSS variables to both `:root` (light mode) and `.dark` sections in `src/index.css`.

### Color Palette
The chart colors will be distinct, vibrant, and accessible in both light and dark modes:

**Light mode:**
- `--chart-1`: `234 89% 60%` (indigo -- matches primary)
- `--chart-2`: `160 84% 39%` (emerald -- matches accent)
- `--chart-3`: `38 92% 50%` (amber -- matches warning)
- `--chart-4`: `350 89% 60%` (rose -- matches destructive)
- `--chart-5`: `270 70% 55%` (purple -- additional contrast)

**Dark mode:**
- `--chart-1`: `234 89% 66%` (brighter indigo)
- `--chart-2`: `160 84% 48%` (brighter emerald)
- `--chart-3`: `38 92% 55%` (brighter amber)
- `--chart-4`: `350 70% 55%` (softer rose)
- `--chart-5`: `270 70% 62%` (brighter purple)

## File Changed
Only **1 file**: `src/index.css` -- add 5 variables to `:root` block and 5 to `.dark` block.

## Impact
This instantly fixes all charts across the entire application:
- Dashboard: Revenue/Expenses, Invoice Status, Cash Flow, Top Customers
- WMS Dashboard: Task Status pie, Tasks by Type bar
- CRM charts: Lead Funnel, Opportunity Pipeline, Win/Loss
- All analytics pages using `--chart-*` variables



# Make Financial Ratio Cards Clickable with Detail Dialogs

## Current State
The ratio cards are static -- they show just the value and a health badge. No interactivity.

## Proposed Enhancement
Each card becomes clickable (with hover cursor and subtle hover effect). Clicking opens a Dialog/Sheet showing:

1. **Formula explanation** -- e.g., "Current Ratio = Current Assets / Current Liabilities"
2. **Component breakdown** -- show the numerator and denominator values used in the calculation (e.g., "Current Assets: 1,245,000 / Current Liabilities: 179,400")
3. **Benchmark context** -- "Industry benchmark: >1.5 (healthy), 1.0-1.5 (caution), <1.0 (risk)"
4. **Interpretation text** -- a short sentence like "Your current ratio of 6.94 indicates strong short-term liquidity."

## Technical Approach

### Data Changes
Extend the `RatioCard` interface with new fields:
- `formula: string` -- e.g., "Current Assets / Current Liabilities"
- `components: { label: string; value: number }[]` -- the raw numbers
- `description: string` -- what this ratio measures
- `interpretation: string` -- dynamic text based on value vs benchmarks

These fields are populated from the already-computed variables (`currentAssets`, `currentLiabilities`, etc.) -- no new DB queries needed. The raw component values will be returned alongside the ratios from the existing `useQuery`.

### UI Changes
- Wrap each `Card` in a clickable div with `cursor-pointer` and hover scale effect
- Use a `Dialog` (already available from radix) to show the detail panel
- Track `selectedCard` state to control which dialog is open

### File Modified
Only `src/pages/tenant/FinancialRatios.tsx` -- single file change. No new files, no routing changes.

### Detail Dialog Content Layout
```
+------------------------------------------+
|  CURRENT RATIO                    [x]    |
|------------------------------------------|
|  6.94              ● Healthy             |
|                                          |
|  Formula:                                |
|  Current Assets / Current Liabilities    |
|                                          |
|  Components:                             |
|  Current Assets      1,245,000.00        |
|  Current Liabilities   179,400.00        |
|                                          |
|  Benchmarks:                             |
|  > 1.5  Healthy  |  1.0-1.5  Caution    |
|  < 1.0  Risk                             |
|                                          |
|  Your ratio of 6.94 indicates strong     |
|  short-term liquidity -- well above      |
|  industry standard.                      |
+------------------------------------------+
```



# Improve Financial Ratio Detail Dialog Design

## Problems Identified
- Benchmark badges are hard to read (colored outlines with no fill, small text)
- Components section lacks visual separation between rows
- Overall dialog feels cramped with inconsistent spacing
- The large number in the center lacks context/unit label
- Formula box styling is plain
- Interpretation text at the bottom is easy to miss

## Redesign

### Dialog Layout Improvements
1. **Header**: Title left-aligned with health badge as a filled pill (not outline), description below in normal weight
2. **Hero value**: Larger font (5xl), centered, with format label underneath (e.g., "ratio", "%", "days")
3. **Formula section**: Styled as a highlighted card with a subtle background and left border accent
4. **Components section**: Table-like layout with alternating row backgrounds for readability, proper alignment
5. **Benchmarks section**: Replace outline badges with a horizontal gauge/bar showing three zones (green/yellow/red) with a marker for the current value -- much more intuitive than three separate badges
6. **Interpretation**: Highlighted box with colored left border matching health status (green/yellow/red)

### Benchmark Visual Gauge
Instead of three small badges, render a simple 3-segment horizontal bar:
```
[=====GREEN=====|===YELLOW===|===RED===]
                        ^
                      6.94
```
This is done with a simple div-based bar (3 colored segments) and a positioned marker. Much more readable than text badges.

### Specific CSS/Layout Changes
- Dialog max width: `sm:max-w-lg` (slightly wider for breathing room)
- Add `p-1` gap between component rows with `rounded bg-muted/50` on alternating rows
- Formula in a `bg-primary/5 border-l-2 border-primary` styled block
- Interpretation in a `bg-accent/10 border-l-2 border-accent` (or warning/destructive based on health) block
- Larger section headers with bottom border instead of just uppercase text

### File Modified
`src/pages/tenant/FinancialRatios.tsx` -- dialog section only (lines 277-354), no structural changes to data or cards

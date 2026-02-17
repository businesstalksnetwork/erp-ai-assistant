
# Mobile-Optimize Limit Detail Dialogs (6M & 8M)

## Problems
From the screenshots, on mobile the limit detail dialogs have several readability issues:
1. Chart is too tall for mobile, wasting space
2. Y-axis labels (6.9M, 4.0M etc.) are cramped with the chart area
3. X-axis month labels overlap each other
4. Tooltip can get cut off at edges
5. The monthly table columns are tight and require horizontal scroll
6. Overall padding/spacing is too generous for small screens

## Solution

### File: `src/components/LimitDetailDialog.tsx`

**Chart adjustments for mobile:**
- Reduce chart height from fixed `280` to responsive: `200` on mobile, `280` on desktop (use `useIsMobile` hook)
- Reduce Y-axis width from `50` to `40` on mobile
- Reduce font sizes on axes from `11` to `9` on mobile
- Reduce chart margins on mobile
- Hide ReferenceLine labels on mobile (they overlap the chart area) -- just keep the lines visible

**Dialog adjustments for mobile:**
- Use `Drawer` on mobile instead of `Dialog` for full-width bottom sheet (or simply make DialogContent full-width on mobile with `sm:max-w-2xl w-full`)
- Reduce padding in the dialog content on mobile
- Make the table text even smaller on mobile (`text-[10px]`)
- Use shorter column headers on mobile (e.g., "Fakt." instead of "Fakture")

**Specific changes:**
1. Import `useIsMobile` hook
2. Use conditional chart height: `isMobile ? 200 : 280`
3. Use conditional Y-axis width: `isMobile ? 35 : 50`
4. Use conditional axis font size: `isMobile ? 9 : 11`
5. Hide ReferenceLine label text on mobile (set value to empty string)
6. Reduce XAxis tick angle on mobile to `-45` with `dy={8}` to prevent overlap
7. Table: use `text-[10px]` on mobile, shorter header labels

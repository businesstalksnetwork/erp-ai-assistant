

## Fix Number Display Breaking in KPI Cards and Stats Bars

### Problem
Large formatted numbers like "1.308.802.479,43 RSD" break/wrap inside KPI cards, pushing "RSD" onto a second line. This happens because:
- No `whitespace-nowrap` on the value container
- Desktop uses full `fmtNum` formatting regardless of number size, producing very long strings
- The currency suffix "RSD" is part of the same text string but can wrap independently

### Solution

**Three-part fix applied across the codebase:**

#### 1. Add auto-scaling text utility (`src/lib/utils.ts`)
Add a `fmtNumAuto` function that uses compact formatting even on desktop when numbers exceed a threshold (e.g., 10 million+), preventing overflow while keeping precision for smaller values.

```
fmtNumAuto(1234.56)           -> "1.234,56"        (normal)
fmtNumAuto(1_308_802_479.43)  -> "1,31B"           (compacted)
```

#### 2. Fix Dashboard KPI card layout (`src/pages/tenant/Dashboard.tsx`)
- Add `whitespace-nowrap` to the KPI value div to prevent mid-value line breaks
- Add `text-base lg:text-xl xl:text-2xl` responsive sizing so large numbers shrink on smaller containers
- Use `fmtNumAuto` instead of raw `fmtNum` for desktop to prevent overflow on extreme values
- Wrap the currency "RSD" in a `<span>` if needed, but primarily rely on nowrap

#### 3. Fix StatsBar value layout (`src/components/shared/StatsBar.tsx`)
- Add `whitespace-nowrap` to the value span
- Add `overflow-hidden text-ellipsis` as a safety net
- Ensure consistent responsive text sizing

### Files Changed

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `fmtNumAuto` that auto-compacts numbers over 10M on any screen |
| `src/pages/tenant/Dashboard.tsx` | Add `whitespace-nowrap`, use auto-compact formatting, responsive text size |
| `src/components/shared/StatsBar.tsx` | Add `whitespace-nowrap` and overflow protection to value span |

### Why This Works
- `whitespace-nowrap` prevents "RSD" from detaching to a new line
- Auto-compacting very large numbers ensures they always fit within a card
- Responsive text sizing (`text-base lg:text-xl xl:text-2xl`) shrinks text to fit narrower grid columns
- These are purely presentational changes with no database or logic impact


## Add Subtle Grid Pattern to Sidebar Backgrounds

The reference image shows a dark navy background with a subtle grid/blueprint-like pattern -- thin lines forming a grid overlay. This will be added as a CSS pseudo-element or background-image pattern on both sidebar inner wrappers.

### Approach

Add a CSS-based grid pattern using `background-image` with `linear-gradient` lines on a pseudo-element overlay, layered on top of the existing gradient background. No image files needed -- pure CSS.

### Changes

**1. `src/index.css`** -- Add a reusable `.sidebar-grid-pattern` utility class:
- Uses `::after` pseudo-element with two repeating linear gradients (horizontal + vertical lines)
- Grid lines: ~1px wide, spaced ~40-50px apart
- Color: very faint white/blue (`rgba(100, 120, 180, 0.06)`) to keep it subtle
- `pointer-events-none` so it doesn't interfere with clicks

**2. `src/layouts/TenantLayout.tsx`** -- Add the `sidebar-grid-pattern` class to the inner gradient wrapper div (line 316).

**3. `src/layouts/SuperAdminLayout.tsx`** -- Add the same `sidebar-grid-pattern` class to the inner gradient wrapper div (line 54).

### Technical Detail

The CSS class will look like:
```css
.sidebar-grid-pattern::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(100, 120, 180, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 120, 180, 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  pointer-events: none;
  z-index: 1;
}
```

The existing `relative` and `overflow-hidden` on the wrapper divs already support this. All sidebar content already has `relative z-10` so it will render above the grid.

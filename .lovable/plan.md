

# Plan: Fix Gray Text in PDF Once and For All

## Root Cause

When we removed the `dark` class toggle from `document.documentElement` (to fix the theme flash), we created a new problem: `html2canvas` reads **computed styles** from the DOM, and since the document is still in dark mode, CSS variables like `--foreground`, `--card-foreground`, `--muted-foreground` resolve to dark theme values (light gray text on dark backgrounds). 

The `.pdf-export` CSS rules in `index.css` use `!important` but `html2canvas` does NOT process CSS rules - it reads the final computed pixel values. So the CSS overrides are completely ignored by the renderer.

The inline style overrides in the JS code try to fix colors element-by-element, but they miss elements that use CSS variable-based classes (like `text-foreground`, `text-card-foreground`) because the code only checks for specific class names like `text-gray-500`.

## Solution

Override ALL CSS custom properties as inline styles directly on the wrapper element. Since inline CSS variables have highest specificity, `html2canvas` will compute all colors using light theme values automatically - no need for element-by-element hacks.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

After creating the wrapper element (line 40, after `wrapper.className = 'pdf-export'`), add inline CSS variable overrides for all theme variables to force light mode values:

```typescript
// Force light theme CSS variables as inline styles
// html2canvas reads computed styles, so CSS !important rules are ignored
// Inline CSS variables override dark theme inheritance
wrapper.style.setProperty('--background', '40 33% 98%');
wrapper.style.setProperty('--foreground', '222 47% 11%');
wrapper.style.setProperty('--card', '0 0% 100%');
wrapper.style.setProperty('--card-foreground', '222 47% 11%');
wrapper.style.setProperty('--popover', '0 0% 100%');
wrapper.style.setProperty('--popover-foreground', '222 47% 11%');
wrapper.style.setProperty('--primary', '45 93% 47%');
wrapper.style.setProperty('--primary-foreground', '222 47% 11%');
wrapper.style.setProperty('--secondary', '40 20% 94%');
wrapper.style.setProperty('--secondary-foreground', '222 47% 20%');
wrapper.style.setProperty('--muted', '40 20% 94%');
wrapper.style.setProperty('--muted-foreground', '220 10% 46%');
wrapper.style.setProperty('--accent', '45 93% 47%');
wrapper.style.setProperty('--accent-foreground', '222 47% 11%');
wrapper.style.setProperty('--destructive', '0 84% 60%');
wrapper.style.setProperty('--destructive-foreground', '0 0% 100%');
wrapper.style.setProperty('--border', '40 20% 90%');
wrapper.style.setProperty('--input', '40 20% 90%');
wrapper.style.setProperty('--ring', '45 93% 47%');
```

This single change makes ALL elements inside the wrapper automatically resolve to light theme colors, because Tailwind classes like `text-foreground`, `bg-card`, `text-muted-foreground` all reference these CSS variables. No per-element hacking needed.

The existing element-by-element style overrides (lines 87-185) can remain as an extra safety net but will no longer be the primary mechanism.

This approach:
- Does NOT touch the live DOM theme (no flash)
- Forces light values at the CSS variable level (all text renders black/dark)
- Works with `html2canvas` because inline variables affect computed styles
- Requires no changes to any other file




# Plan: Fix PDF Gray Text Using html2canvas `onclone` Callback

## Root Cause (for real this time)

html2canvas clones elements into an internal iframe for rendering. Our stylesheet injections and CSS rules in `index.css` may not fully transfer or be parsed correctly by html2canvas's internal CSS engine. This is a known limitation of html2canvas with CSS custom properties (like Tailwind's `hsl(var(--muted-foreground))`).

## Solution

Use html2canvas's built-in `onclone` callback to force styles directly on the cloned elements INSIDE html2canvas's rendering pipeline. Using `element.style.setProperty('color', '#000000', 'important')` sets inline `!important` which is the highest possible CSS specificity and cannot be overridden by any stylesheet rule.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

1. Remove the duplicate stylesheet injection inside the `try` block (lines 156-167) -- it's a bug that re-appends the same element.

2. Add `onclone` callback to the `html2canvas()` call that walks every element in the clone and forces black text with inline `!important`:

```typescript
const canvas = await html2canvas(wrapper, {
  scale: canvasScale,
  useCORS: true,
  backgroundColor: '#ffffff',
  logging: false,
  windowWidth: 794,
  windowHeight: actualHeight,
  height: actualHeight,
  scrollX: 0,
  scrollY: 0,
  onclone: (_clonedDoc, clonedElement) => {
    // Force ALL text to black in the cloned document html2canvas uses
    clonedElement.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty('color', '#000000', 'important');
      htmlEl.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
    });
    clonedElement.style.setProperty('color', '#000000', 'important');
    // Exception: keep white text on dark primary backgrounds
    clonedElement.querySelectorAll('.bg-primary, .bg-primary *').forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty('color', '#ffffff', 'important');
      htmlEl.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    });
  },
});
```

Why this works:
- `onclone` runs on the exact elements html2canvas will render -- no iframe/cloning disconnect
- `style.setProperty('color', '#000000', 'important')` is inline + `!important` = highest possible CSS priority
- No CSS variable resolution needed -- raw hex values set directly
- `.bg-primary` exception preserves white text on the "AMOUNT DUE" header

### Keep existing code:
- The `.dark` class removal and overlay -- still needed for proper light-mode variable resolution
- The stylesheet override in `<head>` -- keep as belt-and-suspenders backup
- Image base64 conversion, table border fixes, etc. -- all untouched

No other files need changes.


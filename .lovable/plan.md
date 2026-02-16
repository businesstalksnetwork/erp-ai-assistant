

# Plan: Post-Process Canvas Pixels to Force Black Text

## Why Previous Attempts Failed

html2canvas v1.4.1 has an internal CSS parser that does not reliably respect inline `!important` overrides, CSS custom properties, or style injections. After 5+ attempts using CSS-level fixes (inline styles, stylesheet injection, `onclone` callbacks, dark class removal), the text remains gray. The library's rendering pipeline is a black box we cannot control.

## New Approach: Canvas Pixel Post-Processing

Instead of fighting html2canvas's CSS parser, let it render whatever colors it wants. Then, AFTER it produces the canvas, we post-process every pixel:

- Gray pixels (not white, not colored) get forced to pure black
- White pixels stay white (backgrounds)
- Colored pixels stay colored (yellow badge, etc.)
- Very dark pixels stay dark (already near-black)

This is guaranteed to work because we operate on the final pixel data -- html2canvas has no say in it.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

After `html2canvas()` returns the canvas and before `pdf.addImage()`, add pixel manipulation:

```typescript
// Post-process canvas: force all gray text to pure black
const ctx = canvas.getContext('2d');
if (ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC - minC;

    // Gray pixel (low saturation) that's not white and not already black
    if (saturation < 50 && lum > 20 && lum < 210) {
      data[i] = 0;       // R -> black
      data[i + 1] = 0;   // G -> black
      data[i + 2] = 0;   // B -> black
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
```

The pixel classification logic:
- `saturation < 50`: Only affect gray/neutral pixels (preserves yellow badge, colored elements)
- `lum > 20`: Don't touch already-black or very dark pixels (preserves dark backgrounds)
- `lum < 210`: Don't touch white/near-white pixels (preserves white backgrounds)
- Everything in between is gray text/borders -- force to black

This preserves:
- White backgrounds (lum > 210)
- Dark primary background with white text (white text has lum > 210, bg has lum < 20)
- Yellow/colored badges (saturation > 50)
- Only gray pixels become black -- exactly what we want

### Keep all existing code

All existing CSS overrides, dark class removal, and style injection remain as-is. They may partially help, and the canvas post-processing acts as the final guarantee.

### No other files need changes.


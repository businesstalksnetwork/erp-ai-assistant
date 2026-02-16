

# Plan: Force All PDF Text to Black

## Why Previous Fixes Still Show Gray

Even with the `.dark` class removed (which IS working), the light theme itself uses gray for labels:
- `text-muted-foreground` in light mode = `hsl(220, 10%, 46%)` = medium gray
- `bg-secondary` = light beige/gray background
- These are by design in light mode, but look bad on a PDF

CSS variable inline overrides on the wrapper don't work because `html2canvas` does not reliably cascade CSS custom properties set as inline styles.

## Solution

After removing `.dark` class and before calling `html2canvas`, walk every element in the clone and force all text to be dark. This is the most reliable approach because inline `style.color` on each element is always respected by `html2canvas`.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

After the `.dark` class is removed (line 135) and before the `html2canvas` call (line 147), add a DOM walk that forces all text colors to be dark:

```typescript
// After removing .dark, force all text in clone to be dark for PDF
const allElements = wrapper.querySelectorAll('*');
allElements.forEach(el => {
  const element = el as HTMLElement;
  const computed = getComputedStyle(element);
  const r = parseInt(computed.color.match(/\d+/g)?.[0] || '0');
  const g = parseInt(computed.color.match(/\d+/g)?.[1] || '0');
  const b = parseInt(computed.color.match(/\d+/g)?.[2] || '0');
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  
  // If text is lighter than ~50% gray, force it dark
  if (luminance > 120) {
    element.style.color = '#1a1a1a';
    element.style.setProperty('-webkit-text-fill-color', '#1a1a1a');
  }
  
  // Force backgrounds to be light
  const bgR = parseInt(computed.backgroundColor.match(/\d+/g)?.[0] || '255');
  const bgG = parseInt(computed.backgroundColor.match(/\d+/g)?.[1] || '255');
  const bgB = parseInt(computed.backgroundColor.match(/\d+/g)?.[2] || '255');
  const bgLuminance = (bgR * 299 + bgG * 587 + bgB * 114) / 1000;
  
  if (bgLuminance < 128) {
    element.style.backgroundColor = '#f5f5f5';
  }
});
```

This approach:
- Reads **computed** styles (which reflect light mode since `.dark` is removed)
- Detects any gray/light text and forces it to near-black
- Detects any dark backgrounds and forces them light
- Uses inline styles directly on each element, which `html2canvas` always respects
- No reliance on CSS variables or class-based overrides

No other files need changes.

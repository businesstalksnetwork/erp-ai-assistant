

# Plan: Force ALL PDF Text to Black (No Threshold)

## Problem

The luminance detection (`> 120`) misses "medium gray" text. In light mode, `text-muted-foreground` = `hsl(220, 10%, 46%)` = ~rgb(106, 110, 126) with luminance ~111, which is BELOW the 120 threshold. So the gray labels (Issue Date, ISSUER, ITEMS, Description, etc.) are never caught.

## Solution

Stop using luminance detection entirely. On a PDF invoice, ALL text should be black. Force `color: #000000` on every single element inside the wrapper. No exceptions, no threshold logic.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

Replace the current element-by-element loop (lines 142-172) with a simpler version:

```typescript
// Force ALL text to black for PDF readability - no exceptions
const allElements = wrapper.querySelectorAll('*');
allElements.forEach(el => {
  const element = el as HTMLElement;
  element.style.color = '#000000';
  element.style.setProperty('-webkit-text-fill-color', '#000000');
  
  // Force any dark backgrounds to white
  const computed = getComputedStyle(element);
  const bgMatch = computed.backgroundColor.match(/\d+/g);
  if (bgMatch) {
    const bgR = parseInt(bgMatch[0]);
    const bgG = parseInt(bgMatch[1]);
    const bgB = parseInt(bgMatch[2]);
    const bgLuminance = (bgR * 299 + bgG * 587 + bgB * 114) / 1000;
    if (bgLuminance < 200) {
      element.style.backgroundColor = 'transparent';
    }
  }
});
// Force wrapper itself
wrapper.style.color = '#000000';
```

Key differences from current code:
- ALL text forced to black -- no luminance check, no threshold
- Dark/gray backgrounds forced to transparent instead of `#f5f5f5` (which was causing the gray "AMOUNT DUE" box)
- Simpler, fewer lines, fewer ways to fail

No other files need changes.

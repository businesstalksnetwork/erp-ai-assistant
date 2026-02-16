

# Plan: Inject Stylesheet Override for PDF Text

## Root Cause

`html2canvas` uses `window.getComputedStyle()` to determine element colors. Inline `element.style.color` changes are being overridden by existing CSS rules that use `!important` (e.g., the `.pdf-export .print-invoice .text-muted-foreground` rule in `index.css`). Since CSS `!important` beats inline styles, our JavaScript overrides have zero effect on elements matching those selectors.

More critically, for elements WITHOUT `!important` rules, `html2canvas` may cache or snapshot computed styles before our inline changes propagate.

## Solution

Instead of setting inline styles element-by-element, inject a temporary `<style>` tag into the document `<head>` with a blanket `!important` rule. This becomes part of the CSSOM and `getComputedStyle()` will always return `#000000`. Remove the style tag after rendering.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

1. **Remove** the entire DOM walker loop (lines 142-163) that sets inline `color`/`backgroundColor` on each element -- it doesn't work with html2canvas.

2. **Add** a temporary `<style>` element injected into `document.head` before the `html2canvas` call:

```typescript
const styleOverride = document.createElement('style');
styleOverride.textContent = `
  .pdf-export, .pdf-export * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
  .pdf-export .bg-primary,
  .pdf-export .bg-primary * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
`;
document.head.appendChild(styleOverride);
```

3. **Remove** the style tag in the `finally` block alongside dark mode restoration:

```typescript
if (styleOverride.parentNode) {
  document.head.removeChild(styleOverride);
}
```

This approach is bulletproof because:
- The style rule is in the CSSOM, not inline styles
- Uses `!important` to override everything
- `getComputedStyle()` (which html2canvas uses) always reflects CSSOM rules
- The `.bg-primary` exception preserves white text on dark header backgrounds (e.g., "AMOUNT DUE" section)
- Cleaned up automatically in the `finally` block

### No other files need changes.

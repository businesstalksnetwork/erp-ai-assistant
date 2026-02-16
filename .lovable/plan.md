

# Plan: Pre-Bake Black Text on Clone Before html2canvas

## Root Cause Analysis

After 4+ failed attempts, the pattern is clear: html2canvas 1.4.1 has its own internal CSS parser that does NOT reliably respect:
- CSS custom properties (`var(--foreground)`)  
- Modern space-separated HSL syntax (`hsl(222 47% 11%)`)
- Stylesheet injections into `document.head`
- Inline style overrides via `onclone` callback

The library captures/computes styles in its own pipeline, and our post-hoc overrides are being ignored or processed incorrectly.

## Solution

Pre-bake `color: #000000` as inline styles directly on the DOM elements BEFORE passing them to `html2canvas()`. Since we already clone the invoice element (`invoiceElement.cloneNode(true)`), we can modify the clone freely. html2canvas will see elements with `style="color: #000000 !important"` baked directly into the HTML -- there is nothing to resolve, parse, or override.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

**After** cloning the invoice element and setting up basic styles (around line 80, before `wrapper.appendChild(clone)`), add a DOM walker that forces every single element's text to black:

```typescript
// PRE-BAKE: Force ALL text colors to black BEFORE html2canvas sees them
// This is the most aggressive approach - colors are in the HTML itself
const allCloneElements = clone.querySelectorAll('*');
allCloneElements.forEach(el => {
  const htmlEl = el as HTMLElement;
  htmlEl.style.setProperty('color', '#000000', 'important');
  htmlEl.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
});
clone.style.setProperty('color', '#000000', 'important');
clone.style.setProperty('-webkit-text-fill-color', '#000000', 'important');

// Exception: .bg-primary elements need white text
clone.querySelectorAll('.bg-primary').forEach(el => {
  const htmlEl = el as HTMLElement;
  htmlEl.style.setProperty('color', '#ffffff', 'important');
  htmlEl.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
  htmlEl.style.setProperty('background-color', '#222222', 'important');
  htmlEl.querySelectorAll('*').forEach(child => {
    const childEl = child as HTMLElement;
    childEl.style.setProperty('color', '#ffffff', 'important');
    childEl.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
  });
});
```

This goes RIGHT BEFORE `wrapper.appendChild(clone)` (before line 81). Insert after the existing `print:hidden` block.

**Keep all existing measures** (stylesheet injection, onclone callback, dark class removal) as layered redundancy.

**Additionally**, in the `onclone` callback, also inject a `<style>` tag into the cloned document's `<head>`:

```typescript
onclone: (clonedDoc, clonedElement) => {
  // Inject override stylesheet into cloned document
  const overrideStyle = clonedDoc.createElement('style');
  overrideStyle.textContent = '* { color: #000000 !important; -webkit-text-fill-color: #000000 !important; } .bg-primary, .bg-primary * { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }';
  clonedDoc.head.appendChild(overrideStyle);
  
  // Also force inline styles on all cloned elements
  clonedElement.querySelectorAll('*').forEach(el => {
    // ... existing code
  });
},
```

### Why This Will Finally Work

Previous attempts failed because they tried to override colors AFTER html2canvas had already captured style data. This approach modifies the actual DOM elements BEFORE html2canvas ever touches them. The inline `style` attribute with `!important` is part of the HTML markup itself -- html2canvas cannot ignore it regardless of how its CSS parser works.

### No other files need changes.


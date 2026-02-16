

# Fix: Amount Disappearing Behind Black Box in PDF

## Root Cause

The invoice's "Amount Due" section uses `bg-slate-800 text-white` and `text-slate-300` classes -- NOT `bg-primary`. The pre-baking code forces ALL text to `color: #000000` but only exempts `.bg-primary` elements. Result: white text on the dark amount section becomes black text on a dark background = invisible.

Additionally, the canvas pixel post-processor turns the `bg-slate-800` background (luminance ~40) to pure black, AND forces any remaining gray text to black too. Double whammy.

## Fix

### File: `src/hooks/usePdfGenerator.ts`

**1. Add exception for `bg-slate-800` in the pre-baking block (alongside existing `.bg-primary` exception):**

After the existing `.bg-primary` exception block (~line 93), add an identical exception for `.bg-slate-800`:

```typescript
// Exception: .bg-slate-800 elements also need white text (amount due section)
clone.querySelectorAll('.bg-slate-800').forEach(el => {
  const htmlEl = el as HTMLElement;
  htmlEl.style.setProperty('color', '#ffffff', 'important');
  htmlEl.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
  htmlEl.style.setProperty('background-color', '#1e293b', 'important');
  htmlEl.querySelectorAll('*').forEach(child => {
    const childEl = child as HTMLElement;
    childEl.style.setProperty('color', '#ffffff', 'important');
    childEl.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
  });
});
```

**2. Add exception in `onclone` callback stylesheet and inline style loop:**

Update the injected stylesheet to also cover `.bg-slate-800`:
```css
.bg-primary, .bg-primary *, .bg-slate-800, .bg-slate-800 * { 
  color: #ffffff !important; 
  -webkit-text-fill-color: #ffffff !important; 
}
```

And add matching inline overrides in the `onclone` element walker.

**3. Update the canvas pixel post-processor to skip dark background pixels:**

Change the luminance lower bound from `lum > 20` to `lum > 80`. This preserves dark backgrounds like `bg-slate-800` (lum ~40) from being turned to pure black, while still catching all gray text (which typically has lum 100-200).

```typescript
if (saturation < 50 && lum > 80 && lum < 210) {
```

## Summary of Changes

All changes are in one file: `src/hooks/usePdfGenerator.ts`
- Add `.bg-slate-800` exception in pre-baking (mirrors `.bg-primary` exception)
- Add `.bg-slate-800` exception in `onclone` callback
- Raise pixel post-processor lower luminance threshold from 20 to 80


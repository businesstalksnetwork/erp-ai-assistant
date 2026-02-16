

# Fix: Black Box in Amount Section - Switch to Light Background for PDF

## Root Cause

All previous attempts tried to preserve the dark `bg-slate-800` background with white text during PDF generation. Despite 4 layers of CSS exceptions (pre-baking, stylesheet override, onclone callback, pixel post-processor), html2canvas still renders black text on the dark background, creating an unreadable black box.

The pixel post-processor then compounds the issue by potentially modifying edge pixels.

## New Approach

Stop fighting html2canvas. Instead, restyle the amount section to use a **light background with dark text** in the PDF clone -- just like everything else on the page. This eliminates the entire dark-bg/white-text problem.

## Changes

### File: `src/hooks/usePdfGenerator.ts`

**1. Change the `.bg-slate-800` pre-baking exception** (lines 104-115) to use a light background with a visible border instead of preserving the dark theme:

```typescript
// Amount due section: convert to light theme for PDF
clone.querySelectorAll('.bg-slate-800').forEach(el => {
  const htmlEl = el as HTMLElement;
  htmlEl.style.setProperty('background-color', '#f1f5f9', 'important');
  htmlEl.style.setProperty('border', '2px solid #1e293b', 'important');
  htmlEl.style.setProperty('color', '#000000', 'important');
  htmlEl.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
  htmlEl.querySelectorAll('*').forEach(child => {
    const childEl = child as HTMLElement;
    childEl.style.setProperty('color', '#000000', 'important');
    childEl.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
  });
});
```

**2. Remove `.bg-slate-800` from the white-text exceptions** in:
- The `styleOverride` stylesheet (lines 181-186) -- remove the `.bg-slate-800` lines since those elements now use black text on light bg
- The `onclone` callback stylesheet (line 213) -- remove `.bg-slate-800` references
- The `onclone` inline style loop (line 224) -- remove `.bg-slate-800` from the white-text selector

**3. No changes to the pixel post-processor** -- with light backgrounds, it works correctly (light bg pixels have lum > 210, text is already black).

## Why This Works

- Light background (#f1f5f9, luminance ~244) is above the post-processor's upper threshold (210), so it stays untouched
- Black text matches the global black-text override -- no exceptions needed, no CSS battles
- A dark border (2px solid #1e293b) keeps the section visually distinct
- The on-screen invoice remains unchanged (dark slate background with white text)

## Summary

One file changed: `src/hooks/usePdfGenerator.ts`
- Convert `.bg-slate-800` from dark-bg/white-text to light-bg/dark-text/dark-border in the PDF clone
- Remove now-unnecessary white-text exceptions for `.bg-slate-800` from stylesheet and onclone




# Plan: Fix PDF Gray Text -- The Nuclear Fix

## Root Cause (Why Previous Fixes Failed)

The issue has three layers, and previous fixes only addressed one at a time:

1. **CSS Variable overrides** (last fix) -- these work for elements using `hsl(var(--foreground))`, but NOT for elements with explicit Tailwind `dark:` variants like `dark:text-gray-300`, `dark:bg-slate-800`.

2. **Inline style overrides** (element-by-element loop) -- the code sets `element.style.color = '#000000'` on cloned elements, BUT `html2canvas` re-reads `getComputedStyle()` at render time from the live DOM where the `.dark` class on `<html>` still activates dark-variant CSS rules. The inline styles set BEFORE the clone is in the DOM may not persist correctly for all properties.

3. **The `.dark` class on `<html>`** remains active throughout the entire process, so every CSS rule with `.dark` prefix still applies to the cloned content.

## Solution: Dark Class Removal with Visual Overlay

Temporarily remove the `.dark` class from `<html>` during `html2canvas` rendering, but prevent the user from seeing any theme flash by adding a full-screen dark overlay first.

## Technical Changes

### File: `src/hooks/usePdfGenerator.ts`

**Before calling `html2canvas`** (around line 273):

1. Check if dark mode is active (`document.documentElement.classList.contains('dark')`)
2. If yes, create a fixed overlay `div` covering the entire viewport with the current dark background color (`#0f1729`), z-index 99999
3. Append the overlay to `document.body`
4. Remove `.dark` class from `document.documentElement`
5. Call `html2canvas` (the wrapper and clone now inherit light-mode styles natively)
6. In the `finally` block, re-add `.dark` class and remove the overlay

This is the same approach used before (removing `.dark`), but with the overlay preventing any visual flash. The user sees a solid dark screen for ~0.5s while the PDF generates, then everything returns to normal.

**Also**: Remove the element-by-element color override loop (lines 131-212) and the CSS variable inline overrides (lines 42-67) since they are no longer needed -- the DOM will natively be in light mode during rendering.

### Summary of changes in `usePdfGenerator.ts`:
- Remove CSS variable `setProperty` calls (lines 42-67) -- no longer needed
- Remove the `querySelectorAll('*')` color override loop (lines 131-212) -- no longer needed  
- Keep table border fixes and print:hidden logic
- Add overlay creation before `html2canvas`
- Add `.dark` class removal before `html2canvas`
- Add `.dark` class restoration and overlay removal in `finally` block

No other files need changes.


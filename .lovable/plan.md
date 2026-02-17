

# Make Button and Search Input the Same Height

## Problem

The "Novi podsetnik" button uses `size="sm"` which gives it `h-9`, while the search Input has the default height of `h-10`. They appear mismatched.

## Solution

Change the button from `size="sm"` to the default size (which is `h-10`), matching the Input height. This makes both elements visually aligned.

## Technical Details

### File: `src/pages/Reminders.tsx` (line 856)

- Remove `size="sm"` from the "Novi podsetnik" Button so it uses the default size (`h-10`), matching the search Input height.


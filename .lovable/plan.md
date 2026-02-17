

# Style Slider Component in App Brand Colors

## What Changes

Update `src/components/ui/slider.tsx` to use the app's golden/amber color scheme instead of the default shadcn colors.

## Technical Details

**File:** `src/components/ui/slider.tsx`

- **Track background:** Change from `bg-secondary` to `bg-sidebar-border` (dark navy) to match the dark sidebar theme visible in the screenshot
- **Range (filled portion):** Keep `bg-primary` which is already the golden/amber color (`hsl(45, 93%, 47%)`)
- **Thumb:** Keep `border-primary` and `bg-background`, which already use the golden border. Add a subtle golden shadow (`shadow-md shadow-primary/20`) for a polished look matching the app's `glow-primary` aesthetic

This ensures the slider matches the app's established dark sidebar + golden accent design system.


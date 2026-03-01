

# Fix CR3-04: Returns.tsx tax_amount hardcoded to 0

## Problem
In `src/pages/tenant/Returns.tsx` line 550, when the user clicks "Edit" on an existing credit note, the form is populated with `tax_amount: 0` instead of the actual `cn.tax_amount` value. This causes the tax amount to be silently zeroed out if the user saves.

## Fix
Single line change on line 550:
```tsx
// Before
tax_amount: 0,
// After  
tax_amount: cn.tax_amount || 0,
```

This is a one-line fix in one file.


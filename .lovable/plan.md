

## Fix Payroll Parameters: Clean Data + Fix Edit Dialog Focus Bug

### Issues Found

**1. Duplicate junk data in database**
Your tenant (`92474a4b`) has 8 duplicate rows for 2025-01-01, all with corrupted rates (stored as `14` instead of `0.14` -- meaning 1400% PIO rate). Only the 2026-01-01 row has correct decimal values. These duplicates need to be deleted via a migration.

**2. Edit dialog loses focus (the main bug)**
The `FormFields` component is defined **inside** the `PayrollParameters` render function (line 152). Every time you type a character, React state updates, the parent re-renders, and a **brand new** `FormFields` component is created. React sees it as a different component, unmounts all inputs, and remounts them -- destroying your cursor position and focus. This is a classic React anti-pattern.

---

### Fix Plan

#### 1. Database cleanup migration

Delete the 8 duplicate 2025-01-01 rows with corrupted rates (where `tax_rate >= 1`, meaning rates were stored as raw percentages instead of decimals). Keep only rows with correct decimal values.

Also add a unique constraint on `(tenant_id, effective_from)` to prevent future duplicates.

**File**: New migration SQL

#### 2. Move FormFields outside the component

Extract `FormFields` to a standalone component defined **outside** the `PayrollParameters` function. This ensures React reuses the same component reference across renders, preserving input focus.

**File**: `src/pages/tenant/PayrollParameters.tsx`

#### 3. Add a delete button for parameter rows

Add a trash icon button on each non-active row so you can manually clean up entries in the future without needing database access.

**File**: `src/pages/tenant/PayrollParameters.tsx`

---

### Technical Details

**Files to create (1):**
- Migration SQL -- delete corrupted duplicates + add unique constraint

**Files to modify (1):**
- `src/pages/tenant/PayrollParameters.tsx` -- extract FormFields outside component, add delete button


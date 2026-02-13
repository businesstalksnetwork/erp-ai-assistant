

# Add Location Assignment to Employees

## What This Does

Adds a "Location" (Lokacija) field to employee records so you can assign each employee to a specific work location -- a store, warehouse, office, or branch. This connects employees to the existing `locations` table, making it easy to see who works where.

---

## Changes

### 1. Database Migration

Add a `location_id` column to the `employees` table, referencing the `locations` table:

```text
ALTER TABLE employees ADD COLUMN location_id uuid REFERENCES locations(id);
CREATE INDEX idx_employees_location_id ON employees(location_id);
```

### 2. Employee Form (Employees.tsx)

- Add `location_id` to the form interface and empty form default
- Fetch active locations (same query pattern as the existing departments query)
- Add a Location dropdown in the form dialog, placed next to the Department dropdown
- Include location in the save payload

### 3. Employee Table

- Add a "Location" (Lokacija) column to the table header
- Display the location name in each row (via a join: `locations(name)`)
- Add location to the CSV export columns

### 4. Supabase Types

- Add `location_id` to the employees type definition

### 5. Translations

- Add `location` / `lokacija` and `noLocation` / `bez lokacije` keys (if not already present)

---

## Files to Modify

| File | Change |
|------|--------|
| New migration SQL | Add `location_id uuid REFERENCES locations(id)` to employees |
| `src/pages/tenant/Employees.tsx` | Add location dropdown, table column, query join, export column |
| `src/integrations/supabase/types.ts` | Add `location_id` to employees type |
| `src/i18n/translations.ts` | Add translation keys if missing |


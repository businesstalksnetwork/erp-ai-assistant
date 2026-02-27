

## Fix: Missing Translation Keys

Two sidebar menu items display raw keys instead of translated text:
- `specialHours` — shown as "specialHours" in HR sidebar
- `dataQualityDashboard` — shown as "dataQualityDashboard" in Analytics sidebar

### Implementation

**File: `src/i18n/translations.ts`**

Add the following keys to both `en` and `sr` translation objects:

- `specialHours`: EN = "Special Hours", SR = "Posebni sati"
- `dataQualityDashboard`: EN = "Data Quality", SR = "Kvalitet podataka"

Single file edit, two keys added to each locale block.


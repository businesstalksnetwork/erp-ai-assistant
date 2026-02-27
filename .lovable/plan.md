

# Fix POPDV Seed Data

## Problem
The `popdv_tax_types` table has ~80 entries with incorrect generic descriptions and is missing ~40% of real entries from the Excel catalogs, including:
- **Missing OUTPUT entries**: 1.4.q, 1.4.w, 1.4.x, 1.4.y, 1.4.z, 1.6, 2.4, 2.6, 3.2.x, 3.4, 3.5.x, 3.6.1, 3.6.x, 3.7.x, 4.1.1, 4.1.3, 4.1.4, 4.2.1, 4.2.2, 4.2.3, 4.2.4, 11.9
- **Missing INPUT entries**: 6.2.3, 8a.2.a, 8a.2.x, 8a.2.y, 8a.2.z, 8a.3, 8a.5.x, 8b.3, 8b.4, 8b.5, 8b.5.x, 8d.1, 8d.2.x, 8d.3, 8e.1.a, 8e.2.a, 9.01–9.19 (15 entries)
- **Wrong IDs**: Current DB has fabricated IDs like 1.5, 3a.3, 4a.*, 5.*, 6.2, 6.3, 6.5, 8dj.1, 8e.1, 8e.2, 8e.5, 9.1–9.3, 10.1, 11.4–11.7 that don't exist in the real POPDV form
- **Wrong descriptions**: Nearly all existing entries have short generic placeholders instead of the official Serbian POPDV descriptions from the Excel files
- **Section headers missing**: Parent section rows (1, 2, 3, 4, 6, 7, 8a, 8b, 8d, 8g, 8v, 9, 11) are absent

## Solution
Single migration that:
1. **DELETE all existing rows** from `popdv_tax_types`
2. **INSERT ~115 correct entries** from both Excel catalogs with:
   - Exact official Serbian descriptions from the uploaded XLSX files
   - Correct `direction` (OUTPUT/INPUT/BOTH)
   - Correct `is_special_record` flags
   - Correct `parent_id` references (from "ID opšte evidencije" column)
   - Proper `popdv_section` assignment
   - Sequential `sort_order` values
3. **Update any `invoice_lines.popdv_field` and `supplier_invoice_lines.popdv_field`** references that used now-removed IDs (e.g., map old fabricated IDs to correct ones where possible, set to NULL where no mapping exists)

## Technical Details

### Data Mapping (Old → New)
Old fabricated IDs that need cleanup:
- `1.5` → NULL (doesn't exist in real POPDV)
- `3.6` (was special_record) → `3.6` (exists but not special)
- `3a.3` → NULL (doesn't exist)
- `4a.*` → NULL (don't exist; real form uses 4.1.1–4.2.4)
- `5.*` → NULL (Section 5 is computed, not input fields)
- `6.2`, `6.3`, `6.5` → NULL
- `8dj.1` → NULL
- `8e.1`, `8e.2`, `8e.5` → NULL (real ones are 8e.1.a, 8e.2.a)
- `9.1`→`9.01`, `9.2`→`9.02`, `9.3`→`9.03`
- `10.1` → NULL (Section 10 is computed)
- `11.4`–`11.7` → NULL

Since this is early in adoption, these references are likely empty. The migration will set unmatched `popdv_field` values to NULL with a safe UPDATE.

### Entry Count
- OUTPUT: ~44 entries (sections 1–4, 6.1, 8a.4/8a.5, 8d, 8e.3/8e.4, 11)
- INPUT: ~54 entries (sections 4.1.2, 6, 7, 8a–8g, 8v, 9, 11.8)
- BOTH: ~6 entries (shared like 8a.4, 8a.5, 8e.3, 8e.4)
- Section headers: ~15 entries (direction=BOTH, is_special_record=true)


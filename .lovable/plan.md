

# Plan: Add CRUD Capabilities and Seed Data to Empty Settings Pages

## Problem

Several settings pages are read-only shells with no way to add, edit, or delete records. When there's no seed data, users see empty screens with no action they can take:

1. **DMS Settings** -- `document_categories`, `confidentiality_levels`, `role_confidentiality_access` are all empty (0 rows). No add/edit/delete UI exists.
2. **Posting Rules** -- 20 rules exist but many have `NULL` debit/credit codes. The page has edit capability but no way to add new custom rules.

## Solution

Two-pronged approach: (A) add seed data via migration so pages aren't empty on first load, and (B) add CRUD UI so users can manage records themselves.

## Changes

### 1. Database Migration: Seed DMS Default Data

Seed data for all existing tenants + trigger for new tenants:

**Document Categories** (~20 categories in 5 groups):
- Opšta administracija (General): Dopisi, Rešenja, Ugovori, Pravilnici
- Finansije (Finance): Fakture, Izvodi, Obračuni, Poreske prijave
- Kadrovi (HR): Ugovori o radu, Rešenja o odmorima, Dosijei
- Komercijala (Sales): Ponude, Narudžbine, Otpremnice, Reklamacije
- Projekti (Projects): Projektna dokumentacija, Izveštaji

**Confidentiality Levels** (4 levels):
- Javno (Public) -- green, sort 1
- Interno (Internal) -- blue, sort 2
- Poverljivo (Confidential) -- orange, sort 3
- Strogo poverljivo (Top Secret) -- red, sort 4

**Access Matrix** (default rules):
- admin: all levels, can_read + can_edit
- manager: Javno + Interno + Poverljivo, can_read + can_edit
- user: Javno + Interno, can_read only

### 2. DMS Settings CRUD UI (`DmsSettings.tsx`)

Add management capabilities to each tab:

**Categories tab:**
- "Add Category" button opens a dialog with fields: code, name_sr, name, group_name_sr, sort_order
- Edit button on each row to modify
- Delete button (with confirmation) for non-system categories

**Confidentiality tab:**
- "Add Level" button with fields: name_sr, name, color (color picker), sort_order
- Edit/delete buttons on each row

**Access Matrix tab:**
- "Add Rule" button with selects: role (from TenantRole list), confidentiality_level (from existing levels), can_read checkbox, can_edit checkbox
- Delete button on each row

### 3. Posting Rules Enhancement (`PostingRules.tsx`)

- Add "Add Custom Rule" button that opens a form with: rule_code, description, module_group, debit/credit account selects
- This allows tenants to extend beyond the seeded rules

### 4. Translation Keys

Add: `addCategory`, `editCategory`, `deleteCategory`, `addConfLevel`, `addAccessRule`, `categoryCode`, `categoryName`, `groupName`, `addCustomRule`, `confirmDelete`, `seedDataLoaded`

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Seed DMS categories, confidentiality levels, access matrix for all tenants + trigger |
| `src/pages/tenant/DmsSettings.tsx` | Add CRUD dialogs for categories, confidentiality levels, and access matrix |
| `src/pages/tenant/PostingRules.tsx` | Add "Add Custom Rule" button and dialog |
| `src/i18n/translations.ts` | Add ~15 new translation keys |


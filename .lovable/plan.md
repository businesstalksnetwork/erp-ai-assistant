

# Add Partner Categories Management Page

## What We're Building

A full CRUD management page for partner/company categories (Kategorije kompanija), adapted from the Uniprom reference project. This lets each tenant create, edit, reorder, and delete their own categories with hierarchical parent/child support, color coding, and system category protection.

## Changes

### 1. New Page: `src/pages/tenant/CompanyCategoriesSettings.tsx`

A dedicated settings page for managing `company_categories` per tenant. Features:
- Table showing all categories with hierarchical indentation (parent -> child via `CornerDownRight` icon)
- Columns: drag handle, Name (name_sr), Code, Color (dot + hex), Type (Sistemska / Korisnicka badge), Actions (edit/delete)
- "Nova kategorija" button opens a dialog with:
  - Parent category selector (optional, for subcategories)
  - Name SR (required), Name EN (required), Code (required, auto-lowercased)
  - Color picker (10 preset color circles)
  - Description (optional textarea)
- Edit dialog pre-fills form, disables code editing for system categories
- Delete with AlertDialog confirmation; disabled for system categories, categories with children, or categories assigned to partners
- All queries filtered by `tenant_id` (not `user_id` like Uniprom)
- Uses `partner_category_assignments` to check if categories are in use before allowing delete

### 2. Update `src/App.tsx`

- Import `CompanyCategoriesSettings`
- Add route: `settings/partner-categories` -> `CompanyCategoriesSettings`

### 3. Update `src/pages/tenant/Settings.tsx`

- Add "Kategorije partnera" link with `Tag` icon to the Organization section, pointing to `/settings/partner-categories`

### 4. Add i18n Keys in `src/i18n/translations.ts`

Add translation keys:
- `partnerCategories` / "Partner Categories" / "Kategorije partnera"
- `newCategory` / "New Category" / "Nova kategorija"
- `parentCategory` / "Parent Category" / "Nadredjena kategorija"
- `systemCategory` / "System" / "Sistemska"
- `userCategory` / "Custom" / "Korisnicka"
- `subcategory` / "Subcategory" / "Potkategorija"
- `categoryCode` / "Code" / "Kod"
- `categoryColor` / "Color" / "Boja"
- `noParent` / "No parent (top-level)" / "Bez nadredjene (glavna kategorija)"
- `cannotDeleteSystem` / "System categories cannot be deleted" / "Sistemske kategorije se ne mogu brisati"
- `cannotDeleteHasChildren` / "Category has subcategories" / "Kategorija ima potkategorije"
- `cannotDeleteInUse` / "Category is assigned to partners" / "Kategorija ima dodeljene partnere"

## Technical Details

- The `company_categories` table already has the full schema needed: `id`, `tenant_id`, `name`, `name_sr`, `code`, `color`, `parent_id`, `is_system`, `sort_order`, `created_at`
- Unique constraint on `(tenant_id, code)` prevents duplicate codes per tenant
- The `partner_category_assignments` table links categories to partners and is used for the "in use" check
- No database migration needed -- all schema already exists


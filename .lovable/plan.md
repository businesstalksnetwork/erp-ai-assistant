

# Add Colors to Partner Type Badges

## What Changes

The partner type column ("Tip") currently shows plain gray outline badges for "Dobavljač", "Kupac", and "Oba". This update adds distinct colors to each type for better visual distinction.

## Changes

### 1. Update `src/pages/tenant/Companies.tsx`
- Add a `TYPE_COLORS` map assigning each partner type a color scheme:
  - **customer (Kupac)**: Blue badge (e.g., `bg-blue-100 text-blue-800`)
  - **supplier (Dobavljac)**: Purple badge (e.g., `bg-purple-100 text-purple-800`)
  - **both (Oba)**: Green badge (e.g., `bg-emerald-100 text-emerald-800`)
- Update the type column render (line 214) to use colored `Badge` instead of plain `variant="outline"`

### 2. Update `src/pages/tenant/CompanyDetail.tsx`
- Apply the same colored type badge on the partner detail page for consistency

No database changes needed -- this is purely a UI styling update. Existing partners will automatically display the correct color based on their `type` field.


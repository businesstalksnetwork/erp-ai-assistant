

# Sidebar Naming, Translation & Placement Fixes

## Issues Identified

1. **POS sidebar items untranslated**: `promotions`, `giftCards`, `marketBasket`, `loyaltyAnalytics` use `as any` casts and have NO translation keys in `translations.ts` — they show raw camelCase keys.

2. **Loyalty sidebar items untranslated**: The Loyalty section nav items (`loyaltyDashboard`, `loyaltyPrograms`, etc.) ARE translated but the screenshot shows the sidebar still displaying raw keys — likely the `as any` cast items in POS are the issue.

3. **Compliance section in tenant sidebar — wrong placement**: CAPA, DSAR, and AI Model Cards are platform governance features (ISO compliance). They belong in the **Super Admin** layout, not in every tenant's sidebar. Regular tenants should not see CAPA/DSAR/AI Model Cards.

4. **`aiModelCards` route points to `/super-admin/ai-model-cards`** but is listed in the tenant sidebar — confusing and inaccessible to non-super-admins.

5. **Compliance label hardcoded** as `"Compliance"` instead of using `t()`.

## Plan

### 1. Add missing translation keys
Add to both `en` and `sr` in `translations.ts`:
- `promotions` → "Promotions" / "Promocije"
- `giftCards` → "Gift Cards" / "Poklon kartice"
- `marketBasket` → "Market Basket" / "Analiza korpe"
- `loyaltyAnalytics` → "Loyalty Analytics" / "Analitika lojalnosti"
- `capaManagement` → "CAPA Management" / "CAPA upravljanje"
- `dsarManagement` → "DSAR Requests" / "DSAR zahtevi"
- `aiModelCards` → "AI Model Cards" / "AI kartice modela"
- `complianceWorkflows` → "Workflows" / "Tokovi rada"

### 2. Remove `as any` casts
Update all nav items using `as any` to use properly typed keys (after adding them to translations).

### 3. Move Compliance out of tenant sidebar
- Remove `complianceNav` array and its `CollapsibleNavGroup` from `TenantLayout.tsx`
- Add CAPA and DSAR routes to the **Super Admin** layout sidebar instead (they are platform-level ISO compliance tools)
- AI Model Cards is already at `/super-admin/ai-model-cards` — just add it to the Super Admin nav if not already there

### 4. Update Super Admin sidebar
Add nav items for:
- CAPA Management → `/super-admin/capa` (move route from `/compliance/capa`)
- DSAR Management → `/super-admin/dsar` (move route from `/compliance/dsar`)
- AI Model Cards already exists at `/super-admin/ai-model-cards`

### 5. Update routes
Move `/compliance/capa` and `/compliance/dsar` routes to `/super-admin/capa` and `/super-admin/dsar` in the route config.

## Files Modified
- `src/i18n/translations.ts` — add ~8 keys in en + sr
- `src/layouts/TenantLayout.tsx` — remove complianceNav, remove `as any` casts
- `src/layouts/SuperAdminLayout.tsx` — add CAPA, DSAR, AI Model Cards nav items
- `src/routes/otherRoutes.tsx` or `src/App.tsx` — move compliance routes under super-admin


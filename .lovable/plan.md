

# Remaining CR11 Items Implementation Plan

## What's left from CR11

8 actionable items remain. CR11-10 (CSS selector) was confirmed no-change-needed. CR11-05 (eOtpremnice stubs), CR11-11 (PDF/A ICC), CR11-14 (CI e2e), CR11-26 (AI bias testing) are infrastructure/external and out of scope for this session.

## Items to implement

### 1. CR11-06: MarketBasketAnalysis i18n (Serbian-only → t() keys)
Add ~15 new translation keys (en + sr) for all hardcoded strings in `MarketBasketAnalysis.tsx`: page title, subtitle, button labels, card titles, table headers, badge labels, empty state text. Replace all inline Serbian strings with `t()` calls.

### 2. CR11-07: DsarManagement i18n (English-only → t() keys)
Add ~15 new translation keys for `DsarManagement.tsx`: page title, stat card labels, table headers, dialog title/labels, button text. Some keys (`dsarTitle`, `dsarTotalRequests`, `dsarDaysLeft`) already exist — add the missing ones (`dsarPending`, `dsarOverdue`, `dsarCompleted`, `dsarNewRequest`, `dsarSubject`, `dsarType`, `dsarDeadline`, `dsarActions`, `dsarNoRequests`, `dsarSubjectName`, `dsarSubjectEmail`, `dsarRequestType`, `dsarDescription`, `dsarSubmitRequest`).

### 3. CR11-16: SplitPaymentDialog hardcoded Serbian labels
The `METHODS` array has hardcoded Serbian labels ("Gotovina", "Kartica", "Prenos", "Mobilno"). Add translation keys and use `t()`. Also the badge text in `liftBadge` function of MarketBasket ("Jak", "Umeren", "Slab").

### 4. CR11-19: settingsModules translation key
`TenantLayout.tsx` references `section: "settingsModules"` but the key doesn't exist in translations. Add `settingsModules` to both en and sr.

### 5. CR11-20: Remove dead @radix-ui/react-toast package
Still in `package.json` line 43. Remove it.

### 6. CR11-22 & CR11-23: Move @types/qrcode and rollup-plugin-visualizer to devDependencies
These are build/dev-only tools sitting in `dependencies`.

### 7. CR11-24: Eliminate `as any` casts on translation keys
3,158 occurrences across 105 files. The root fix: add all missing keys to `translations.en` and `translations.sr` so the `TranslationKey` type includes them. This is a large batch — I'll extract the unique missing key names from the `as any` casts and add them all at once.

**Strategy**: Rather than editing 105 files to remove `as any`, add all missing keys to translations.ts so the type covers them, then do a bulk find-replace removing `as any` from `t()` calls across all affected files.

## Implementation order

1. Add all missing translation keys to `translations.ts` (covers CR11-06, 07, 16, 19, 24)
2. Update `MarketBasketAnalysis.tsx` — replace hardcoded strings with `t()` calls
3. Update `DsarManagement.tsx` — replace hardcoded strings with `t()` calls
4. Update `SplitPaymentDialog.tsx` — use `t()` for method labels
5. Remove `@radix-ui/react-toast` from dependencies, move `@types/qrcode` and `rollup-plugin-visualizer` to devDependencies
6. Bulk remove `as any` casts from `t()` calls across all 105 files

## Files modified

| File | Change |
|------|--------|
| `src/i18n/translations.ts` | ~200+ new keys (en + sr) |
| `src/pages/tenant/MarketBasketAnalysis.tsx` | All strings → `t()` |
| `src/pages/tenant/DsarManagement.tsx` | All strings → `t()` |
| `src/components/pos/SplitPaymentDialog.tsx` | Method labels → `t()` |
| `package.json` | Remove react-toast, move 2 deps to devDeps |
| 105 files with `t("..." as any)` | Remove `as any` casts |

## Technical note
The bulk `as any` removal across 105 files will be done file-by-file. Given the volume, the highest-traffic files will be prioritized and remaining files cleaned in subsequent passes if needed.


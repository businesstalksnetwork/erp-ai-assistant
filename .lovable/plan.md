

# Fix Untranslated & Hardcoded Strings in Profile Page

## Issues Found

1. **"assets" tab label** — uses `t("assets" as any)` but no `assets` key exists in translations → shows raw English "assets" instead of proper Serbian
2. **"Current PIN: "** — hardcoded English string (line 285)
3. **"HR"** — hardcoded mobile fallback (line 149)
4. **Multiple `as any` casts** — `profilePersonalData`, `profileHrSection`, `profileSalaryInfo`, `notifications` keys exist in translations but are cast with `as any`, meaning they're not in the TypeScript type

## Changes

### 1. `src/i18n/translations.ts`
- Add missing keys to the `TranslationKey` type: `profilePersonalData`, `profileHrSection`, `profileSalaryInfo`, `profileAssets`, `currentPin`
- Add `profileAssets` key: EN = `"Assets & Equipment"`, SR = `"Imovina i oprema"`
- Add `currentPin` key: EN = `"Current PIN:"`, SR = `"Trenutni PIN:"`
- Verify all profile-related keys are properly typed (no more `as any`)

### 2. `src/pages/tenant/Profile.tsx`
- Replace `t("assets" as any)` → `t("profileAssets")`
- Replace `t("notifications" as any)` → `t("notifications")`
- Remove all `as any` casts from `t()` calls
- Replace hardcoded `"Current PIN: "` → `t("currentPin")`
- Replace hardcoded `"HR"` → short form of `t("profileHrSection")`


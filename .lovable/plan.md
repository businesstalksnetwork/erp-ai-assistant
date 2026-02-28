

## Phase 6: Frontend Design — Hydration, Responsive, Accessibility, i18n

### Findings Summary

| Category | Issue Count | Severity |
|----------|------------|----------|
| Hydration bug (`useIsMobile`) | 1 | HIGH — SSR/first-render mismatch |
| Hardcoded Serbian strings (i18n violations) | ~80+ across 30+ files | MEDIUM — breaks language switching |
| Error boundaries with hardcoded text | 2 components | MEDIUM — not translatable |
| Offline banner hardcoded text | 1 component | LOW |
| Date input hardcoded aria-label | 1 component | LOW |
| Accessibility: missing skip-nav, lang attr | 2 | LOW |

---

### Bug 1: Hydration mismatch in `useIsMobile`

**File:** `src/hooks/use-mobile.tsx`

`useState<boolean | undefined>(undefined)` initializes as `undefined`, then the `useEffect` sets the real value. On first render, `!!undefined` returns `false`, so every component using `useIsMobile()` renders the desktop layout first, then potentially flips to mobile — causing a flash/layout shift.

**Fix:** Initialize with `typeof window !== 'undefined' ? window.innerWidth < 768 : false` to get the correct value on first render. This eliminates the initial `undefined` state entirely.

### Bug 2: ErrorBoundary hardcoded Serbian strings

**Files:** `src/components/ErrorBoundary.tsx`, `src/components/shared/PageErrorBoundary.tsx`

Both error boundaries have hardcoded Serbian text: "Nešto je pošlo naopako", "Pokušaj ponovo", "Kontrolna tabla", "Došlo je do greške", "Nazad". These don't respect the locale setting.

**Fix:** Since error boundaries are class components and can't use hooks, wrap the error UI in a functional component that uses `useLanguage()`. Add translation keys: `somethingWentWrong`, `tryAgain`, `goBack`, `unexpectedError`, `dashboardLink`.

### Bug 3: OfflineBanner hardcoded Serbian string

**File:** `src/components/OfflineBanner.tsx`

"Nemate internet konekciju. Promene će biti sačuvane kada se ponovo povežete." is hardcoded.

**Fix:** Use `useLanguage()` hook and add translation keys `offlineMessage`.

### Bug 4: DateInput hardcoded aria-label

**File:** `src/components/ui/date-input.tsx`

`aria-label="Izaberi datum"` is hardcoded Serbian. Since this is a low-level UI component that doesn't have access to i18n context easily, accept an optional `ariaLabel` prop with a sensible English default ("Pick a date").

### Bug 5: Inline `sr ? "..." : "..."` patterns in ~63 files

**Files:** 63 files with 2842 matches of inline locale conditionals.

This is the biggest i18n violation. Key offenders by volume:
- Fleet module: `FleetVehicleForm`, `FleetFuelLog`, `FleetServiceOrders`, `FleetInsurance` — fully hardcoded Serbian
- Lease module: `LeaseContracts`, `LeaseContractForm`, `LeaseContractDetail`, `LeaseDisclosure`
- Analytics: `PivotTable` ("UKUPNO"), `SavedViewManager` ("Sačuvaj")
- Production: `ProductionGantt`, `ProductionKanban`
- Accounting: `ConsolidatedStatements`, `CostCenterPL`, `KepKnjiga`
- WMS: `WmsReceiving`
- Other: `PppdReview`, `InventoryWriteOff`, `IosConfirmations`

**Fix:** This is too large for a single pass. Prioritize the **most-used modules** (Fleet, Lease, Analytics, Production) by:
1. Adding ~60 new translation keys to `translations.ts`
2. Replacing inline conditionals with `t()` calls in the top ~20 offending files

### Bug 6: HTML `lang` attribute not set

**File:** `index.html` or `src/App.tsx`

The `<html>` element doesn't dynamically set `lang="en"` or `lang="sr"` based on locale, which is an accessibility requirement for screen readers.

**Fix:** Add a `useEffect` in `LanguageProvider` that sets `document.documentElement.lang = locale === "sr" ? "sr-Latn" : "en"`.

---

### Execution Order

1. **Fix hydration bug** — `use-mobile.tsx` (1 line change, highest impact)
2. **Set HTML lang attribute** — `LanguageContext.tsx`
3. **Internationalize error boundaries** — `ErrorBoundary.tsx`, `PageErrorBoundary.tsx`
4. **Internationalize OfflineBanner** — `OfflineBanner.tsx`
5. **Fix DateInput aria-label** — `date-input.tsx`
6. **Add ~60 translation keys** — `translations.ts`
7. **Replace inline i18n in top 20 files** — Fleet, Lease, Analytics, Production modules

### Files Modified

| File | Bug |
|------|-----|
| `src/hooks/use-mobile.tsx` | 1 |
| `src/i18n/LanguageContext.tsx` | 6 |
| `src/components/ErrorBoundary.tsx` | 2 |
| `src/components/shared/PageErrorBoundary.tsx` | 2 |
| `src/components/OfflineBanner.tsx` | 3 |
| `src/components/ui/date-input.tsx` | 4 |
| `src/i18n/translations.ts` | 5, 6 |
| ~20 page files (Fleet, Lease, Analytics, Production) | 5 |


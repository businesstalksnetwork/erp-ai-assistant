

# Settings Pages -- Comprehensive Issues and Improvements

## Summary

After reviewing all settings pages, the database seed data status, and the code quality across ~25 settings-related files, here are the issues organized by severity.

---

## Critical Issues

### 1. Hardcoded Serbian strings (no i18n) -- 16 files affected

Many pages bypass the `t()` translation system entirely, using hardcoded Serbian strings for toast messages, labels, descriptions, and button text. This breaks the app for English-language users.

**Affected files and examples:**
- `CompanyCategoriesSettings.tsx` -- `toast.success('Kategorija je uspešno kreirana')`, `'Čuvanje...'`, `'Upravljajte kategorijama...'`, `'Nema kategorija. Dodajte prvu kategoriju.'`, `'Greška: '`
- `CashRegister.tsx` -- `toast.success("Stavka blagajne kreirana")`
- `RecurringJournals.tsx` -- `toast.success("Šablon kreiran")`, `"Šablon obrisan"`
- `RecurringInvoices.tsx` -- `toast.success("Šablon kreiran")`, `"Otkaži"` button
- `TransferPricing.tsx` -- `toast.success("Povezano lice dodato")`
- `WithholdingTax.tsx` -- `toast.success("Obračun kreiran")`, `"Otkaži"`, `"Čuvanje..."`
- `IntercompanyTransactions.tsx` -- `toast.success("Intercompany transakcija kreirana")`
- `ReportSnapshots.tsx` -- `toast.success("Snapshot obrisan")`
- `EmployeeDetail.tsx` -- `"Kategorija prihoda"` label

**Fix:** Replace all hardcoded Serbian strings with `t("key")` calls and add corresponding keys to `translations.ts`.

### 2. Missing translation keys -- `as any` type casts (14 files, 159 occurrences)

Many translation calls use `t("key" as any)`, meaning the keys exist at runtime but are not in the TypeScript type definition. This hides missing-key errors and indicates keys that were added to `translations.ts` but not to the type union.

**Most affected:**
- `DiscountApprovalRules.tsx` -- `t("discountApprovalRules" as any)`, `t("maxDiscountPct" as any)`, `t("requiresApprovalAbove" as any)`, `t("addRule" as any)`
- `PdvPeriods.tsx` -- `t("pdvSubmitted" as any)`, `t("partnerName" as any)`
- `Leads.tsx` -- `t("firstName" as any)`, `t("lastName" as any)`, `t("jobTitle" as any)`
- `InvoiceForm.tsx` -- `t("invoiceType" as any)`

**Fix:** Add the missing keys to the `TranslationKey` type definition so TypeScript catches real missing keys.

---

## UX Issues

### 3. Browser `confirm()` used instead of AlertDialog -- 4 files

Using the native `confirm()` dialog breaks the visual consistency and doesn't work well on mobile. Other pages correctly use `<AlertDialog>` for deletions.

**Affected:**
- `DmsSettings.tsx` -- 3 delete actions use `confirm()`
- `PayrollPaymentTypes.tsx` -- delete uses `confirm(sr ? "Obrisati?" : "Delete?")`
- `PayrollParameters.tsx` -- delete uses `confirm(t("deleteConfirmation"))`
- `PayrollCategories.tsx` -- delete uses `confirm(sr ? "Obrisati?" : "Delete?")`

**Fix:** Replace `confirm()` with `<AlertDialog>` component (pattern used in `Locations.tsx`, `ApprovalWorkflows.tsx`, etc.).

### 4. Inconsistent toast libraries

Some pages use `import { toast } from "sonner"` (direct sonner), others use `import { useToast } from "@/hooks/use-toast"` (shadcn wrapper). This causes inconsistent toast positioning and styling.

**Pages using sonner directly:** `DiscountApprovalRules.tsx`, `CompanyCategoriesSettings.tsx`, `BusinessRules.tsx`, `OpportunityStagesSettings.tsx`, `CashRegister.tsx`, `RecurringJournals.tsx`, `RecurringInvoices.tsx`

**Pages using `useToast`:** `Currencies.tsx`, `Locations.tsx`, `BankAccounts.tsx`, `TaxRates.tsx`, `PostingRules.tsx`, `DmsSettings.tsx`

**Fix:** Standardize on one approach. `useToast` (shadcn wrapper) is the dominant pattern.

### 5. Tax Rates page missing delete functionality

The `TaxRates.tsx` page has Add and Edit but no Delete button. Users cannot remove obsolete tax rates.

**Fix:** Add a delete button with `AlertDialog` confirmation, similar to other CRUD pages.

### 6. Currencies page -- no delete capability

`Currencies.tsx` has Add and Edit but no way to delete a currency. Users who accidentally add a wrong currency cannot remove it.

**Fix:** Add delete button with protection against deleting the base currency or currencies referenced in exchange rates.

### 7. Posting Rules -- no delete capability for custom rules

Users can add custom rules but cannot delete them if they were created in error.

**Fix:** Add a delete action for non-system rules (rules not in the predefined `MODULE_GROUPS` arrays).

---

## Data Quality Issues

### 8. Seed data verified -- all tables populated

Database counts confirm all previously-empty tables now have seed data:
- `location_types`: 12 rows
- `approval_workflows`: 9 rows
- `discount_approval_rules`: 12 rows
- `document_categories`: 54 rows
- `confidentiality_levels`: 12 rows
- `role_confidentiality_access`: 27 rows

No further seeding needed.

---

## Proposed Plan

### Phase 1: Fix hardcoded strings and missing types (highest impact)

1. **`translations.ts`** -- Add ~30 missing keys and fix the `TranslationKey` type to include all keys used with `as any`
2. **16 files** -- Replace hardcoded Serbian strings with `t()` calls

### Phase 2: Fix UX consistency

3. **4 files** -- Replace `confirm()` with `<AlertDialog>` component
4. **7 files** -- Standardize toast imports to `useToast`
5. **`TaxRates.tsx`** -- Add delete button with confirmation
6. **`Currencies.tsx`** -- Add delete button (protected for base currency)
7. **`PostingRules.tsx`** -- Add delete button for custom rules

### Files Changed

| File | Changes |
|------|---------|
| `src/i18n/translations.ts` | Add ~30 keys, fix `TranslationKey` type |
| `src/pages/tenant/CompanyCategoriesSettings.tsx` | Replace ~15 hardcoded strings with `t()`, switch to `useToast` |
| `src/pages/tenant/RecurringJournals.tsx` | Replace hardcoded strings |
| `src/pages/tenant/RecurringInvoices.tsx` | Replace hardcoded strings |
| `src/pages/tenant/CashRegister.tsx` | Replace hardcoded strings |
| `src/pages/tenant/TransferPricing.tsx` | Replace hardcoded strings |
| `src/pages/tenant/WithholdingTax.tsx` | Replace hardcoded strings |
| `src/pages/tenant/IntercompanyTransactions.tsx` | Replace hardcoded strings |
| `src/pages/tenant/ReportSnapshots.tsx` | Replace hardcoded strings |
| `src/pages/tenant/EmployeeDetail.tsx` | Replace hardcoded label |
| `src/pages/tenant/DmsSettings.tsx` | Replace `confirm()` with `AlertDialog` |
| `src/pages/tenant/PayrollPaymentTypes.tsx` | Replace `confirm()` with `AlertDialog`, fix toast |
| `src/pages/tenant/PayrollParameters.tsx` | Replace `confirm()` with `AlertDialog` |
| `src/pages/tenant/PayrollCategories.tsx` | Replace `confirm()` with `AlertDialog`, fix toast |
| `src/pages/tenant/DiscountApprovalRules.tsx` | Remove `as any` casts, switch to `useToast` |
| `src/pages/tenant/TaxRates.tsx` | Add delete button |
| `src/pages/tenant/Currencies.tsx` | Add delete button |
| `src/pages/tenant/PostingRules.tsx` | Add delete for custom rules |


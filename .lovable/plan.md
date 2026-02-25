

# Plan: Complete i18n Fix -- Replace All Hardcoded Strings with t() Calls

## Problem

Despite previous fixes, there are still **14 files** using inline `sr ? "..." : "..."` patterns (1,064 occurrences), **7 files** with hardcoded English-only toast messages, and **1 file** with a hardcoded Serbian label. These bypass the translation system entirely, causing inconsistent language switching and poor maintainability.

Additionally, several files still use `toast` from `sonner` directly instead of the standardized `useToast` hook, and some use `window.confirm()` instead of `AlertDialog`.

## Scope

### Files using `sr ? "..." : "..."` pattern (14 files, ~1,064 inline translations)

| File | Approx. inline strings |
|------|----------------------|
| `PayrollPaymentTypes.tsx` | ~80 |
| `PayrollCategories.tsx` | ~50 |
| `NonEmploymentIncome.tsx` | ~60 |
| `CitTaxReturn.tsx` | ~30 (all hardcoded SR) |
| `AnalyticsDashboard.tsx` | ~25 |
| `CashFlowForecast.tsx` | ~40 |
| `BankDocumentImport.tsx` | ~35 |
| `EmployeeDetail.tsx` | ~5 |
| `OpportunityStagesSettings.tsx` | ~5 |
| `Register.tsx` | ~5 |
| `ResetPassword.tsx` | ~3 |
| + 3 others (from search) | ~20 each |

### Files with hardcoded English-only strings

| File | Examples |
|------|---------|
| `Register.tsx` | `"Check your email to confirm your account!"` |
| `ResetPassword.tsx` | `"Check your email for the reset link!"` |
| `OpportunityStagesSettings.tsx` | `"Name and code are required"` |
| `LegacyImport.tsx` | `"Please select the CSV file first"`, `"Import complete!"` |

### Files still using `sonner` directly instead of `useToast`

| File |
|------|
| `PayrollPaymentTypes.tsx` |
| `PayrollCategories.tsx` |
| `NonEmploymentIncome.tsx` |
| `CitTaxReturn.tsx` |
| `OpportunityStagesSettings.tsx` |
| `EmployeeDetail.tsx` |

### Files using `window.confirm()` instead of AlertDialog

| File |
|------|
| `NonEmploymentIncome.tsx` |

## Technical Approach

### 1. Add ~120 new translation keys to `translations.ts`

Group by module:
- **Payroll** (~40 keys): `paymentTypes`, `paymentTypesSeedSuccess`, `seedDefaults`, `newType`, `editPaymentType`, `paymentCategory`, `baseTable`, `rateType`, `compensationPct`, `surchargePct`, `glDebitDefault`, `glCreditDefault`, `nontaxable`, `reducesRegular`, `hotMeal`, `benefit`, `earning`, `sickLeave`, `advance`, `reversal`, `hourly`, `monthly`, `average`, `employer`, `healthFund`, `maternity`, `disability`, `glAccountsPerEntity`, `noLegalEntities`, `defaultGlNote`, `customOverride`, `incomeCategories`, `incomeCategoriesDesc`, `newCategory`, `editCategory`, `seedCategories`, `noCategoriesSeed`, `benCoefficient`, `subsidyTax`, `subsidyPio`
- **Non-Employment Income** (~20 keys): `nonEmploymentIncome`, `nonEmploymentIncomeDesc`, `newIncome`, `editIncome`, `recipient`, `recipientType`, `incomeType`, `grossAmount`, `normalizedExpenses`, `incomeDate`, `calculated`, `noNonEmploymentRecords`, `employee`, `founder`, `pensioner`, `uninsured`, `nonResident`
- **CIT Tax Return** (~15 keys): `citTaxReturn`, `citTaxReturnDesc`, `fiscalYear`, `totalRevenue`, `totalExpenses`, `accountingProfit`, `taxableBase`, `taxRate`, `taxAmount`, `citCalculation`, `createCitReturn`, `creating`, `returnExists`, `createdReturns`, `allEntities`
- **Analytics Dashboard** (~10 keys): `analyticsDashboard`, `grossMargin`, `currentRatio`, `debtEquity`, `profitTrend`, `revenueVsExpenses`, `breakdown`, `momRevenueGrowth`, `growthPct`
- **Cash Flow Forecast** (~15 keys): `cashFlowForecast`, `bankBalance`, `outstandingAR`, `upcomingAP`, `monthlyLoanPayment`, `collectionRate`, `historicalForecast`, `dashedLinesForecast`, `monthlySummary`, `inflow`, `outflow`, `inflowForecast`, `outflowForecast`, `netForecast`, `cumulativeCash`, `negativeBalanceWarning`
- **Bank Document Import** (~15 keys): `bankDocumentImport`, `dropFilesHere`, `orClickToSelect`, `selectFiles`, `autoDetect`, `duplicate`, `importComplete`, `parsed`, `pending`, `quarantine`, `processing`, `matched`, `transactions`, `file`, `format`, `availableCsvProfiles`
- **Auth** (~5 keys): `checkEmailConfirm`, `checkEmailReset`, `nameCodeRequired`
- **General/Shared** (~5 keys): `glMappingSaved`, `paymentTypesSeeded`, `categoriesSeeded`, `incomeCategory`

### 2. Convert all 14 files from `sr ? "..." : "..."` to `t("key")`

Each file will:
- Remove `const sr = locale === "sr"` variable
- Replace all `sr ? "Serbian" : "English"` with `t("translationKey")`
- Switch from `toast` (sonner) to `useToast` hook where applicable
- Replace `window.confirm()` with `AlertDialog` where applicable

### 3. Fix hardcoded English-only strings

- `Register.tsx`: `"Check your email..."` → `t("checkEmailConfirm")`
- `ResetPassword.tsx`: `"Check your email..."` → `t("checkEmailReset")`
- `OpportunityStagesSettings.tsx`: `"Name and code are required"` → `t("nameCodeRequired")`
- `LegacyImport.tsx`: Various hardcoded strings → `t()` calls

## Files Changed

| File | Changes |
|------|---------|
| `src/i18n/translations.ts` | Add ~120 new keys for EN + SR |
| `src/pages/tenant/PayrollPaymentTypes.tsx` | Replace ~80 inline strings with t(), switch to useToast |
| `src/pages/tenant/PayrollCategories.tsx` | Replace ~50 inline strings with t(), switch to useToast |
| `src/pages/tenant/NonEmploymentIncome.tsx` | Replace ~60 inline strings, switch to useToast, add AlertDialog |
| `src/pages/tenant/CitTaxReturn.tsx` | Replace ~30 hardcoded SR strings, add useLanguage + t(), switch to useToast |
| `src/pages/tenant/AnalyticsDashboard.tsx` | Replace ~25 inline strings with t() |
| `src/pages/tenant/CashFlowForecast.tsx` | Replace ~40 inline strings with t() |
| `src/pages/tenant/BankDocumentImport.tsx` | Replace ~35 inline strings with t() |
| `src/pages/tenant/EmployeeDetail.tsx` | Replace hardcoded "Kategorija prihoda" label |
| `src/pages/tenant/OpportunityStagesSettings.tsx` | Replace hardcoded toast, switch to useToast |
| `src/pages/Register.tsx` | Replace hardcoded English toast messages |
| `src/pages/ResetPassword.tsx` | Replace hardcoded English toast messages |
| `src/pages/tenant/LegacyImport.tsx` | Replace hardcoded English strings |
| `src/pages/tenant/PayrollRunDetail.tsx` | Replace hardcoded SR toast messages |
| `src/pages/tenant/Payroll.tsx` | Replace hardcoded SR toast messages |

## Implementation Order

Due to the large number of files (~15), implementation will proceed in batches:
1. **translations.ts** -- add all ~120 keys first
2. **Payroll files** (PayrollPaymentTypes, PayrollCategories, Payroll, PayrollRunDetail) -- highest density of inline strings
3. **Finance files** (NonEmploymentIncome, CitTaxReturn, CashFlowForecast) -- many hardcoded SR strings
4. **Analytics + Import** (AnalyticsDashboard, BankDocumentImport)
5. **Remaining** (EmployeeDetail, OpportunityStagesSettings, Register, ResetPassword, LegacyImport)


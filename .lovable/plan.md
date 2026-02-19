
# Complete Translation Audit — Gap Analysis & Fix Plan

## Summary of Issues Found

After reviewing all 3,361 lines of `translations.ts` and scanning all affected component files, here are the exact translation gaps:

---

## GAP 1: `BusinessRules.tsx` — Month Names Hardcoded in English

**File:** `src/pages/tenant/BusinessRules.tsx`, lines 47–52

The `MONTHS` array is hardcoded as English strings and is NOT translated through the `t()` system:

```js
const MONTHS = [
  { value: 1, label: "January" },   // should be "Januar"
  { value: 4, label: "April" },      // should be "April"
  { value: 7, label: "July" },       // should be "Jul"
  { value: 10, label: "October" },   // should be "Oktobar"
];
```

This is exactly what the screenshot shows — the month dropdown shows "January", "April", "July", "October" even in Serbian mode.

**Fix:** Add translation keys `monthJanuary`, `monthApril`, `monthJuly`, `monthOctober` in both EN and SR, and replace the hardcoded labels with `t()` calls inside the component.

---

## GAP 2: `PayrollParameters.tsx` — Entire Page is Hardcoded Serbian

**File:** `src/pages/tenant/PayrollParameters.tsx`

This page uses **zero** `t()` calls. All strings are hardcoded in Serbian only:
- `"Parametri obračuna zarada"` (page title)
- `"Poreske stope i osnivice za obračun zarada (ažuriraju se po zakonu)"` (description)
- `"Trenutno aktivni parametri"` (card title)
- `"Aktivan od"`, `"Važi za sve obračune od"` (active badge/description)
- All parameter labels: `"Porez na zarade"`, `"Neoporezivi iznos"`, `"PIO zaposleni"`, etc.
- `"Istorija parametara"`, `"Novi set parametara"` (history section)
- `"Dodaj nove parametre (važe od datuma)"` (form title)
- All form field labels in the add-new section
- Table headers: `"Važi od"`, `"Porez"`, `"Neoporezivi"`, `"PIO zap."`, etc.
- Success/error toasts: `"Parametri sačuvani"`, `"Greška"`

**Fix:** Add ~20 translation keys for payroll parameter UI, and refactor all hardcoded strings to use `t()`.

---

## GAP 3: `AiAuditLog.tsx` — Entire Page is Hardcoded Serbian

**File:** `src/pages/tenant/AiAuditLog.tsx`

This page also uses **zero** `t()` calls:
- `"AI Revizijski dnevnik"` (page title)
- `"Pregled svih AI akcija za regulatornu usklađenost (PRD Sekcija 11.2)"` (description)
- `"AI akcije ({logs.length})"` (card title)
- `"Modul"`, `"Odluka"` (filter placeholders)
- `"Svi moduli"`, `"Sve odluke"` (filter defaults)
- `"Odobreno"`, `"Odbijeno"`, `"Izmenjeno"`, `"Automatski"` (decision filter options)
- Table headers: `"Vreme"`, `"Modul"`, `"Tip akcije"`, `"Odluka"`, `"Poverenje"`, `"Model"`, `"Obrazloženje"`
- `"Učitavanje..."` (loading state)
- `"Nema zabeleženih AI akcija."`, `"AI akcije će se automatski beleži kada koristite AI funkcionalnosti."` (empty state)

**Fix:** Add ~15 translation keys for AI audit log UI, and refactor all hardcoded strings to use `t()`.

---

## GAP 4: `CashflowForecastWidget.tsx` — Hardcoded Serbian Labels

**File:** `src/components/dashboard/CashflowForecastWidget.tsx`

Hardcoded Serbian strings:
- `"Prognoza novčanih tokova"` (card title)
- `"Na osnovu otvorenih faktura i obaveza prema dobavljačima"` (subtitle)
- Period labels: `"0–30 dana"`, `"31–60 dana"`, `"61–90 dana"`
- `"↑ Prihodi"`, `"↓ Rashodi"`, `"Neto"` (row labels)
- `"* RSD. Prikazani iznosi su projektovani na osnovu rokova plaćanja otvorenih stavki."` (footnote)

**Fix:** Add ~8 translation keys for cashflow widget, and refactor to use `t()`.

---

## GAP 5: `ComplianceDeadlineWidget.tsx` — Hardcoded Serbian Labels

**File:** `src/components/dashboard/ComplianceDeadlineWidget.tsx`

Hardcoded Serbian strings:
- `"Zakonski rokovi"` (card title)
- `"Predstojeće regulatorne obaveze"` (subtitle)
- Deadline labels: `"PDV prijava (PP-PDV)"`, `"SEF evidencija"`, `"PPP-PD (porez na zarade)"`, `"Doprinosi PIO/ZZO"`
- Detail strings: `"Rok: 12. u mesecu"`, `"Do 15. u mesecu za prethodni mesec"`, `"Do 15. u mesecu"`, etc.
- `"Svi periodi podneti"`, `"Period {name} nije podnet"` (dynamic strings)
- Badge labels: `"Podneto"`, `"Kasni"`

**Fix:** Add ~12 translation keys for compliance widget, and refactor to use `t()`.

---

## GAP 6: Missing Translation Keys in `translations.ts` (Both Locales)

The following translation keys exist in **EN but are MISSING from SR** section (or are identical to EN — i.e., untranslated):

After comparing EN keys (lines 2–1701) vs SR keys (lines 1702–3357), the following are confirmed missing or need to be added to the SR section:

1. `aiAuditLog` — missing in SR (key exists in EN but no SR equivalent noted in the sr block)
2. `legacyImport` — missing in SR 
3. `auditData` (new Settings section heading) — missing in both
4. `cashflowForecast` / `cashflowForecastTitle` — new keys needed
5. `complianceDeadlines` — new key needed
6. Month names for Business Rules

---

## Files to Modify

| File | Action |
|---|---|
| `src/i18n/translations.ts` | Add ~55 missing translation keys to both EN and SR sections |
| `src/pages/tenant/BusinessRules.tsx` | Replace hardcoded month labels with `t()` calls |
| `src/pages/tenant/PayrollParameters.tsx` | Replace all hardcoded Serbian strings with `t()` calls |
| `src/pages/tenant/AiAuditLog.tsx` | Replace all hardcoded Serbian strings with `t()` calls |
| `src/components/dashboard/CashflowForecastWidget.tsx` | Replace hardcoded Serbian strings with `t()` + `useLanguage()` |
| `src/components/dashboard/ComplianceDeadlineWidget.tsx` | Replace hardcoded Serbian strings with `t()` + `useLanguage()` |

---

## New Translation Keys to Add

### English (EN) additions:
```
// Month names (for Business Rules fiscal year start selector)
monthJanuary: "January"
monthApril: "April"
monthJuly: "July"
monthOctober: "October"

// Payroll Parameters page
currentActiveParams: "Current Active Parameters"
activeFrom: "Active from"
paramHistory: "Parameter History"
newParamSet: "New Parameter Set"
addNewParams: "Add new parameters (effective from date)"
payrollTaxRate: "Income Tax Rate (%)"
pioEmployee: "PIO Employee (%)"
pioEmployer: "PIO Employer (%)"
healthEmployee: "Health Employee (%)"
healthEmployer: "Health Employer (%)"
unemploymentRate: "Unemployment (%)"
minBase: "Min. Contribution Base (RSD)"
maxBase: "Max. Contribution Base (RSD)"
noSavedParams: "No saved parameters."
paramsSaved: "Parameters saved"
paramsSavedDesc: "New parameter set is active from the selected date."
activeParam: "Active"

// AI Audit Log page
aiAuditLogTitle: "AI Audit Log"
aiAuditLogDesc: "Review all AI actions for regulatory compliance"
aiActions: "AI Actions"
allModules: "All Modules"
allDecisions: "All Decisions"
actionType: "Action Type"
confidence: "Confidence"
modelVersion: "Model"
reasoning: "Reasoning"
modified: "Modified"
auto: "Automatic"
noAiActions: "No AI actions recorded."
noAiActionsHint: "AI actions will be automatically logged when you use AI features."

// Cashflow Forecast Widget
cashflowForecastTitle: "Cash Flow Forecast"
cashflowForecastSubtitle: "Based on open invoices and supplier payables"
days0to30: "0–30 days"
days31to60: "31–60 days"
days61to90: "61–90 days"
netCashflow: "Net"
cashflowDisclaimer: "* RSD. Amounts projected based on payment due dates of open items."

// Compliance Deadline Widget
complianceDeadlinesTitle: "Regulatory Deadlines"
complianceDeadlinesSubtitle: "Upcoming compliance obligations"
pdvDeadlineLabel: "VAT Return (PP-PDV)"
sefDeadlineLabel: "SEF Evidence"
pppDeadlineLabel: "PPP-PD (Payroll Tax)"
pioContribLabel: "PIO/ZZO Contributions"
sefDeadlineDetail: "Due: 12th of month"
pppDeadlineDetail: "By 15th of month for prior month"
contribDeadlineDetail: "By 15th of month"
allPdvSubmitted: "All periods submitted"
pdvPeriodNotSubmitted: "Period {name} not submitted"
deadlineSubmitted: "Submitted"
deadlineLate: "Late"

// Settings section headings
auditData: "Audit & Data"
```

### Serbian (SR) additions (same keys, Serbian values):
```
monthJanuary: "Januar"
monthApril: "April"
monthJuly: "Jul"
monthOctober: "Oktobar"
currentActiveParams: "Trenutno aktivni parametri"
activeFrom: "Aktivan od"
paramHistory: "Istorija parametara"
newParamSet: "Novi set parametara"
addNewParams: "Dodaj nove parametre (važe od datuma)"
payrollTaxRate: "Porez na zarade (%)"
pioEmployee: "PIO zaposleni (%)"
pioEmployer: "PIO poslodavac (%)"
healthEmployee: "Zdravstvo zaposleni (%)"
healthEmployer: "Zdravstvo poslodavac (%)"
unemploymentRate: "Nezaposlenost (%)"
minBase: "Min. osnovica (RSD)"
maxBase: "Maks. osnovica (RSD)"
noSavedParams: "Nema sačuvanih parametara."
paramsSaved: "Parametri sačuvani"
paramsSavedDesc: "Novi set parametara je aktivan od izabranog datuma."
activeParam: "Aktivan"
aiAuditLogTitle: "AI Revizijski dnevnik"
aiAuditLogDesc: "Pregled svih AI akcija za regulatornu usklađenost"
aiActions: "AI akcije"
allModules: "Svi moduli"
allDecisions: "Sve odluke"
actionType: "Tip akcije"
confidence: "Poverenje"
modelVersion: "Model"
reasoning: "Obrazloženje"
modified: "Izmenjeno"
auto: "Automatski"
noAiActions: "Nema zabeleženih AI akcija."
noAiActionsHint: "AI akcije će se automatski beležiti kada koristite AI funkcionalnosti."
cashflowForecastTitle: "Prognoza novčanih tokova"
cashflowForecastSubtitle: "Na osnovu otvorenih faktura i obaveza prema dobavljačima"
days0to30: "0–30 dana"
days31to60: "31–60 dana"
days61to90: "61–90 dana"
netCashflow: "Neto"
cashflowDisclaimer: "* RSD. Prikazani iznosi su projektovani na osnovu rokova plaćanja otvorenih stavki."
complianceDeadlinesTitle: "Zakonski rokovi"
complianceDeadlinesSubtitle: "Predstojeće regulatorne obaveze"
pdvDeadlineLabel: "PDV prijava (PP-PDV)"
sefDeadlineLabel: "SEF evidencija"
pppDeadlineLabel: "PPP-PD (porez na zarade)"
pioContribLabel: "Doprinosi PIO/ZZO"
sefDeadlineDetail: "Rok: 12. u mesecu"
pppDeadlineDetail: "Do 15. u mesecu za prethodni mesec"
contribDeadlineDetail: "Do 15. u mesecu"
allPdvSubmitted: "Svi periodi podneti"
pdvPeriodNotSubmitted: "Period {name} nije podnet"
deadlineSubmitted: "Podneto"
deadlineLate: "Kasni"
auditData: "Revizija i podaci"
```

---

## Implementation Order

1. **`translations.ts`** — Add all ~55 new keys to both EN and SR sections
2. **`BusinessRules.tsx`** — Replace `MONTHS` array labels with `t("monthJanuary")` etc.
3. **`PayrollParameters.tsx`** — Replace all ~20 hardcoded strings with `t()` calls; add `useLanguage()` hook
4. **`AiAuditLog.tsx`** — Replace all ~15 hardcoded strings with `t()` calls
5. **`CashflowForecastWidget.tsx`** — Add `useLanguage()` hook and replace ~8 hardcoded strings
6. **`ComplianceDeadlineWidget.tsx`** — Add `useLanguage()` hook and replace ~12 hardcoded strings + dynamic detail strings

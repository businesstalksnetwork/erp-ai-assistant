

## Translate AI Insight Severity Badges

### Problem

In the AI Insights widget on the dashboard, the severity badges display raw English strings -- "critical", "info", "warning" -- instead of professional Serbian translations.

The issue is on line 108 of `src/components/ai/AiInsightsWidget.tsx`:
```
{insight.severity}
```

### Changes

#### 1. `src/components/ai/AiInsightsWidget.tsx`

Replace `{insight.severity}` on line 108 with a translated severity label using a local map:

```ts
const severityLabels: Record<string, string> = {
  critical: t("critical"),
  warning: t("severityWarning"),
  info: t("severityInfo"),
};
```

Then render: `{severityLabels[insight.severity]}`

Also translate the two hardcoded strings on lines 80 and 85:
- `"Analiziranje podataka..." / "Analyzing data..."` to use a translation key
- `"Nema dostupnih uvida." / "No insights available."` to use a translation key

#### 2. `src/components/shared/AiModuleInsights.tsx`

Same fix for the hardcoded `"Analiziranje..."` on line 67 -- replace with translation key.

#### 3. `src/i18n/translations.ts`

Add missing keys to both EN and SR sections:
- `severityWarning`: EN "Warning" / SR "Upozorenje"
- `severityInfo`: EN "Info" / SR "Informacija"
- `analyzingData`: EN "Analyzing data..." / SR "Analiziranje podataka..."
- `noInsightsAvailable`: EN "No insights available." / SR "Nema dostupnih uvida."

(The `critical` key already exists as "Critical" / "Kritican".)

### Technical Details

**Files to modify (3):**
- `src/components/ai/AiInsightsWidget.tsx` -- translate severity badge + hardcoded strings
- `src/components/shared/AiModuleInsights.tsx` -- translate loading text
- `src/i18n/translations.ts` -- add 4 new translation keys

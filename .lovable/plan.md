

## Rename to "Brzi AI Izveštaj" + Add Date Range Picker

### What Changes

1. **Rename the page** from "AI Executive Briefing" to "Brzi AI Izveštaj" (Serbian) / "Quick AI Report" (English)
2. **Add a date range selector** with presets: Danas (Today), 7 dana, 30 dana, 90 dana, Custom range
3. **Pass date range to the edge function** so all SQL queries are filtered by the selected period
4. **Update the nav label** in TenantLayout and translations

---

### Technical Details

#### File: `src/pages/tenant/AiBriefing.tsx`

- Change PageHeader title to "Brzi AI Izveštaj" / "Quick AI Report"
- Add state for date range: `dateFrom` and `dateTo`
- Add a row of preset buttons (Danas, 7 dana, 30 dana, 90 dana, Prilagodi) using the existing Button component
- For custom range: show two date inputs (using the existing `DateInput` component) when "Prilagodi" is selected
- Include `date_from` and `date_to` in the query key and in the body sent to the edge function
- Auto-trigger refetch when date range changes

#### File: `supabase/functions/ai-executive-briefing/index.ts`

- Parse `date_from` and `date_to` from the request body (default to last 30 days if not provided)
- Apply date filters to all relevant queries:
  - `invoices` filtered by `invoice_date` within range
  - `pos_transactions` filtered by `created_at` within range
  - `production_orders` filtered by date range
  - `leave_requests` filtered by date range
  - Overdue invoices still use `today` for the overdue check but scope to range
- Pass the date range info to the AI prompt so it knows the period being analyzed

#### File: `src/layouts/TenantLayout.tsx`

- No structural change needed, just the translation key renders the new name

#### File: `src/i18n/translations.ts`

- Update `aiBriefing` key: SR = "Brzi AI Izveštaj", EN = "Quick AI Report"

### Files to Change

| File | Change |
|------|--------|
| `src/pages/tenant/AiBriefing.tsx` | Rename title, add date range presets + custom date inputs, pass dates to API |
| `supabase/functions/ai-executive-briefing/index.ts` | Accept `date_from`/`date_to`, filter all queries by date range |
| `src/i18n/translations.ts` | Update `aiBriefing` translation to "Brzi AI Izveštaj" / "Quick AI Report" |


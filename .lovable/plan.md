

## Phase 8: AI Improvements (Days 22-35)

### Current State Assessment

| Area | Status | Gaps |
|------|--------|------|
| AI Copilot | Streaming chat with 12 tools, role-aware prompts, context-aware suggested questions, conversation history (pinned/tags) | No conversation search; suggested questions only cover ~10 routes; no quick-action buttons (e.g. "Run anomaly scan"); no feedback mechanism (👍/👎) |
| AI Insights | Rule-based + Gemini enrichment across 30+ contexts via `ai-insights`, cached in `ai_insights_cache` with language support | Cache TTL is fixed (no manual refresh); no "explain this insight" drill-down; insights don't link to actionable pages |
| Daily Digest | Time-aware briefing (Morning/Midday/Evening) with `ai-daily-digest` edge function | No weekly digest email content customization; no opt-out per digest section |
| Proactive Agent | Checks overdue invoices, critical stock, expiring contracts, leave conflicts, stale opportunities, revenue concentration | No scheduled cron trigger (manual only); alerts don't create notifications automatically; missing checks for payroll deadlines and budget overruns |
| AI Tools | 12 tools: query, trend, reminder, compare periods, what-if, KPI scorecard, explain account, search docs, partner dossier, cashflow forecast, anomaly detection, report generation | No "create draft invoice" or "create journal entry" write tools; no HR-specific tools (leave balance, headcount summary); invoice-ocr uses old `api.lovable.dev` URL |
| Security | Prompt injection detection, rate limiting (20/min), token tracking, SQL validation | Good coverage, no major gaps |
| Module Insights | `AiModuleInsights` on ~15 pages, `AiAnalyticsNarrative` on analytics pages | Missing from Fleet, Lease, Production calendar, DMS pages |

---

### Plan (7 items)

#### 1. Fix invoice-ocr gateway URL (critical bug)
`invoice-ocr/index.ts` uses old `https://api.lovable.dev/v1/chat/completions` URL — update to `https://ai.gateway.lovable.dev/v1/chat/completions` and update model to `google/gemini-2.5-flash`.

#### 2. Add AI feedback mechanism (👍/👎)
- Create `ai_feedback` table: `id, tenant_id, user_id, conversation_id, message_index, feedback (thumbs_up/thumbs_down), comment, created_at`
- Add thumbs up/down buttons on each AI response in `AiContextSidebar`
- Optional comment on thumbs down
- Track feedback for quality monitoring

#### 3. Expand Copilot suggested questions to all modules
- Add suggested questions for: Fleet, Lease, Production, DMS, POS, Assets, Bank Reconciliation, Payroll, Settings
- Add quick-action buttons below chat input: "📊 KPI Scorecard", "🔍 Anomaly Scan", "📈 Cash Forecast"
- Total coverage: ~25 route prefixes (up from ~10)

#### 4. Add proactive agent cron + auto-notifications
- Add new checks: payroll run deadlines (5 days before month-end), budget overrun alerts (>90% spent), lease expiry (30 days)
- Wire `proactive-ai-agent` to `create-notification` — each alert creates a notification for relevant roles
- Add cron schedule in `config.toml` for daily execution

#### 5. Add 2 new Copilot write tools
- `create_draft_invoice`: Creates a draft invoice from natural language ("Create invoice for Partner X, 3x Product Y at 100 RSD")
- `get_hr_summary`: Returns headcount, active leave requests, upcoming contract expirations, payroll status
- Update tool count badge from "12 tools" to "14 tools"

#### 6. Add AiModuleInsights to missing pages
- Fleet Vehicles, Fleet Fuel Log, Fleet Service Orders
- Lease Contracts
- DMS Documents
- Production Calendar
- Assets list
- Total: 7 additional pages

#### 7. Improve insight drill-down + actionable links
- Make each insight card in `AiModuleInsights` clickable → navigates to relevant page
- Add "Ask AI about this" button on insights → pre-fills Copilot with context
- Add manual refresh button on `AiModuleInsights` (bypass cache)

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/invoice-ocr/index.ts` | Fix gateway URL + model |
| New migration SQL | `ai_feedback` table |
| `src/components/ai/AiContextSidebar.tsx` | Feedback buttons, expanded questions, quick-action buttons |
| `supabase/functions/proactive-ai-agent/index.ts` | New checks, auto-notification creation |
| `supabase/config.toml` | Cron schedule for proactive agent |
| `supabase/functions/ai-assistant/index.ts` | 2 new tools (create_draft_invoice, get_hr_summary) |
| `src/components/shared/AiModuleInsights.tsx` | Clickable insights, "Ask AI" button, refresh button |
| 7 page files | Add `<AiModuleInsights>` component |
| `src/i18n/translations.ts` | ~15 new keys |

### Execution Order
1. Fix invoice-ocr gateway URL (quick fix)
2. DB migration (ai_feedback table)
3. Translation keys
4. Copilot feedback mechanism
5. Expand suggested questions + quick actions
6. New Copilot tools
7. Proactive agent improvements
8. AiModuleInsights expansion + drill-down

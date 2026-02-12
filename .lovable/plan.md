

# Phase 10: AI Assistant & Smart Insights

Integrate AI-powered features across the ERP, delivering on the "AI from the start" product strategy. This phase adds a conversational AI assistant for natural-language queries and anomaly/insight detection surfaced directly in the dashboard.

---

## What Gets Built

### 1. AI Chat Assistant
A slide-out panel accessible from every page that lets users ask questions in natural language (EN/SR). Examples:
- "What are my top 5 overdue invoices?"
- "Show me revenue trend for the last 6 months"
- "Which products are below reorder level?"

The assistant translates questions into Supabase queries scoped to the user's tenant, returning formatted answers.

### 2. Anomaly Detection & Smart Alerts
Background analysis that surfaces unusual patterns on the tenant dashboard:
- Unusually large invoices (> 3x average)
- Revenue spikes or drops (> 20% month-over-month)
- Inventory items at zero or negative stock
- Overdue receivables concentration on a single partner
- Payroll cost anomalies

### 3. Dashboard AI Insights Widget
A new card on the tenant dashboard showing the top 3-5 AI-generated insights, refreshed on page load.

---

## Architecture

### Edge Function: `ai-assistant`
- Receives natural language query + tenant_id
- Uses an LLM (OpenAI or similar) to classify intent and generate a safe, read-only SQL query
- Executes the query against the tenant's data (with RLS via service role scoped to tenant)
- Returns a formatted natural-language answer with optional data table

### Edge Function: `ai-insights`
- Called on dashboard load (or scheduled)
- Runs a set of predefined analytical queries against tenant data
- Applies threshold-based anomaly detection rules
- Returns a list of insights with severity, description, and suggested action

### Database

| Table | Purpose |
|-------|---------|
| `ai_conversations` | Chat history: tenant_id, user_id, messages (JSONB array), created_at |
| `ai_insights_cache` | Cached insights: tenant_id, insight_type, severity (info/warning/critical), title, description, data (JSONB), generated_at, expires_at |

---

## Frontend

### New Components

| Component | Description |
|-----------|-------------|
| `AiAssistantPanel.tsx` | Slide-out drawer with chat interface, accessible via floating button on all tenant pages |
| `AiInsightsWidget.tsx` | Dashboard card showing latest AI-generated insights with severity badges |

### Modified Pages

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Add floating AI assistant button + drawer |
| `src/pages/tenant/Dashboard.tsx` | Add AI Insights widget card |

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/..._ai_tables.sql` | 2 tables with RLS |
| `supabase/functions/ai-assistant/index.ts` | NL query processing edge function |
| `supabase/functions/ai-insights/index.ts` | Anomaly detection edge function |
| `src/components/ai/AiAssistantPanel.tsx` | Chat drawer component |
| `src/components/ai/AiInsightsWidget.tsx` | Dashboard insights card |

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Add AI assistant floating button and panel |
| `src/pages/tenant/Dashboard.tsx` | Add insights widget |
| `src/i18n/translations.ts` | Add EN/SR keys for AI features |
| `supabase/config.toml` | Register new edge functions |

---

## Security Considerations

- The AI assistant generates **read-only SELECT queries only** -- no mutations allowed
- All queries are executed with tenant_id filtering enforced at the query level (defense in depth on top of RLS)
- Query results are capped (LIMIT 100) to prevent data exfiltration
- Chat history is stored per-tenant with RLS isolation
- The LLM API key is stored as a Supabase secret, never exposed to the frontend

---

## Technical Notes

- The assistant needs an LLM API key (OpenAI) configured as a project secret
- Intent classification maps user questions to predefined query templates for safety, rather than generating arbitrary SQL
- Insights use simple statistical thresholds initially (no ML models needed) -- e.g., compare current month vs. 3-month rolling average
- Serbian language support: the LLM handles both EN and SR input natively; insight text is generated in the user's selected language
- Conversation context is maintained per session for follow-up questions
- Insights are cached for 1 hour to avoid redundant computation on dashboard refreshes


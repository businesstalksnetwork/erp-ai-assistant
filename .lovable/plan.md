

## End-to-End AI Module Upgrade

### Current State Summary

The app has 5 AI edge functions and ~10 frontend AI components:

| Component | What it does | Key gaps |
|-----------|-------------|----------|
| `ai-assistant` | Copilot chat with SQL tool-calling (3 rounds) | No streaming from AI (fakes SSE by chunking final text), no conversation persistence, limited to 3 tool rounds, schema context is hardcoded/stale |
| `ai-insights` | Rule-based anomaly detection (overdue invoices, stock, payroll, etc.) | No AI involved (pure SQL checks), no trending/time-series, insights are generic text not actionable |
| `ai-analytics-narrative` | Sends page KPI data to Gemini for narrative summary | No tool-calling (can't query DB for context), just parrots back what you send it, no caching |
| `production-ai-planning` | Schedule/bottleneck/simulation via tool-calling | Already upgraded -- good shape |
| `wms-slotting` | Warehouse slot optimization via tool-calling | Already upgraded -- good shape |
| `AiContextSidebar` | Persistent sidebar with insights + chat + narrative | Good architecture, but chat uses fake streaming |
| `AiAssistantPanel` | Floating sheet chat panel | Duplicate of sidebar logic, uses real streaming but duplicates all code |
| `AiAuditLog` | Reads `ai_action_log` table | No AI actions actually write to this table yet |

---

### Upgrade Plan (8 changes)

#### 1. True Streaming for AI Assistant (Backend)

**Problem**: `ai-assistant` currently runs non-streaming AI calls (up to 3 tool rounds), then fakes SSE by chunking the final text into 20-char pieces. This means the user waits for ALL tool calls + AI response before seeing anything.

**Fix**: After tool-calling rounds complete, make the final AI call with `stream: true` and pipe the real SSE stream directly to the client. This gives instant token-by-token output for the final answer while keeping the tool-calling loop non-streaming (which is correct -- you need to parse tool calls synchronously).

**File**: `supabase/functions/ai-assistant/index.ts`

---

#### 2. Conversation Persistence (DB + Frontend)

**Problem**: Chat history is lost on page reload. Users can't resume conversations.

**Changes**:
- Create `ai_conversations` table: `id`, `tenant_id`, `user_id`, `title`, `created_at`, `updated_at`
- Create `ai_conversation_messages` table: `id`, `conversation_id`, `role` (user/assistant/tool), `content`, `created_at`
- RLS: users can only access their own conversations within their tenant
- Frontend: Auto-save messages after each exchange, add conversation list in sidebar, "New Chat" button
- Auto-generate conversation title from first user message (truncated to 50 chars)

**Files**: Migration SQL, `useAiStream.ts`, `AiContextSidebar.tsx`, `AiAssistantPanel.tsx`

---

#### 3. AI-Powered Insights Engine (Hybrid: Rules + AI)

**Problem**: `ai-insights` is 100% rule-based SQL checks -- no actual AI. The "AI Insights" branding is misleading.

**Fix**: After collecting all rule-based insights, send the top 10 to Gemini with a system prompt asking it to:
- Prioritize by business impact
- Add cross-module correlation (e.g. "overdue invoices + low stock = supply chain risk")
- Generate 2-3 strategic recommendations connecting multiple signals
- Return a `summary` field with a 1-sentence executive overview

This makes insights genuinely AI-enhanced without removing the fast deterministic checks.

**File**: `supabase/functions/ai-insights/index.ts`

---

#### 4. AI Analytics Narrative with DB Tool-Calling

**Problem**: `ai-analytics-narrative` receives KPI data from the frontend and just parrots it back as prose. The AI has no ability to query for additional context (e.g. "which specific account caused the spike?").

**Fix**: Add a `query_tenant_data` tool (reuse the same pattern from `ai-assistant`) so the narrative AI can:
- Drill into specific accounts driving a ratio
- Compare with prior period data
- Look up specific partner/product names

Also add response caching: store results in a new `ai_narrative_cache` table (tenant_id, context_type, narrative, recommendations, expires_at). Cache for 30 minutes.

**Files**: `supabase/functions/ai-analytics-narrative/index.ts`, migration for cache table

---

#### 5. AI Audit Trail (Actually Write to `ai_action_log`)

**Problem**: The `ai_action_log` table and viewer page exist but nothing writes to it. The audit log is always empty.

**Fix**: Add audit logging calls to all AI edge functions:
- `ai-assistant`: Log each tool-calling SQL query (action_type: "sql_query", module: detected from query)
- `ai-insights`: Log the AI enrichment call (action_type: "insight_generation")  
- `ai-analytics-narrative`: Log each narrative generation (action_type: "narrative_generation", module: context_type)
- `production-ai-planning`: Log schedule/bottleneck/simulation generations
- `wms-slotting`: Log slotting optimization runs

Each log entry includes: `tenant_id`, `user_id`, `action_type`, `module`, `model_version` ("gemini-3-flash-preview"), `confidence_score` (null for chat), `user_decision` ("auto" for insights, null for chat), `reasoning` (truncated prompt/response summary).

**Files**: All 5 edge functions

---

#### 6. Deduplicate AI Chat Components

**Problem**: `AiAssistantPanel.tsx` (floating button/sheet) and `AiContextSidebar.tsx` (persistent sidebar) duplicate 90% of the same streaming/chat logic.

**Fix**: 
- Remove `AiAssistantPanel.tsx` entirely (the sidebar is the canonical chat interface)
- The sidebar already has all features: suggested questions, module insights, narrative, chat
- Update `TenantLayout.tsx` to remove the floating button import
- The floating Sparkles button is redundant when the sidebar toggle exists

**Files**: Delete `AiAssistantPanel.tsx`, update `TenantLayout.tsx`

---

#### 7. Dynamic Schema Context for AI Assistant

**Problem**: The `SCHEMA_CONTEXT` in `ai-assistant` is a hardcoded string listing tables. When new tables are added (e.g. `production_scenarios`, `wms_slotting_scenarios`), the AI doesn't know about them.

**Fix**: Query `information_schema.columns` at runtime (cached for 1 hour in-memory) to build the schema context dynamically. Filter to `public` schema only, exclude system tables. This ensures the AI always knows about all available tables.

**File**: `supabase/functions/ai-assistant/index.ts`

---

#### 8. Enhanced AI Assistant: Multi-Tool Support

**Problem**: The assistant only has one tool (`query_tenant_data`). Users ask questions that need computation or action suggestions but the AI can only query.

**Fix**: Add 2 new tools:
- `analyze_trend`: Given a metric name and time range, calculates MoM/YoY growth rates and returns trend data. This handles "what's the trend?" questions more precisely than raw SQL.
- `create_reminder`: Creates a notification/reminder for the user about something the AI flagged (e.g. "Remind me to follow up on overdue invoices next Monday"). Inserts into `notifications` table.

Increase tool rounds from 3 to 5 to allow more complex multi-step reasoning.

**File**: `supabase/functions/ai-assistant/index.ts`

---

### Documentation Update

Update `ARCHITECTURE_DOCUMENTATION.md` with:
- New tables: `ai_conversations`, `ai_conversation_messages`, `ai_narrative_cache`
- Updated edge function capabilities (streaming, audit logging, dynamic schema, multi-tool)
- Removed component: `AiAssistantPanel.tsx`
- AI audit trail flow description

---

### Technical Details

**Database migration (1 migration file)**:
```sql
-- ai_conversations for chat persistence
CREATE TABLE ai_conversations (...)
-- ai_conversation_messages  
CREATE TABLE ai_conversation_messages (...)
-- ai_narrative_cache for analytics caching
CREATE TABLE ai_narrative_cache (...)
-- RLS policies for all 3 tables
```

**Edge functions to modify** (5 files):
- `supabase/functions/ai-assistant/index.ts` -- true streaming, dynamic schema, multi-tool, audit logging
- `supabase/functions/ai-insights/index.ts` -- AI enrichment layer, audit logging
- `supabase/functions/ai-analytics-narrative/index.ts` -- tool-calling, caching, audit logging
- `supabase/functions/production-ai-planning/index.ts` -- audit logging only
- `supabase/functions/wms-slotting/index.ts` -- audit logging only

**Frontend files to modify** (4 files):
- `src/hooks/useAiStream.ts` -- conversation persistence
- `src/components/ai/AiContextSidebar.tsx` -- conversation list, new chat
- `src/layouts/TenantLayout.tsx` -- remove AiAssistantPanel import
- `ARCHITECTURE_DOCUMENTATION.md` -- documentation sync

**Frontend file to delete** (1 file):
- `src/components/ai/AiAssistantPanel.tsx`

**Edge functions to deploy**: ai-assistant, ai-insights, ai-analytics-narrative, production-ai-planning, wms-slotting


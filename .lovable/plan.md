

## Phase 4: AI Personalization — Role-Aware Briefings and Chat

### Current State
- **Briefing** (`ai-executive-briefing`): Already has `roleSystemPrompts` and `detectRole()` but uses string matching on the role name (e.g., "account" → accountant). Does NOT use the actual `app_role` enum value directly.
- **Chat** (`ai-assistant`): System prompt is generic — same for all roles. No role-aware tool filtering or context scoping.
- **Frontend**: Neither `AiBriefing.tsx` nor `useAiStream.ts` sends the user's role to the edge functions. The briefing function fetches it server-side from `tenant_members`, but chat does not.
- Both edge functions already fetch membership; the chat function fetches `membership.id` but not `membership.role`.

### Plan

#### Step 1: Edge Function — Role-aware chat system prompt

Modify `supabase/functions/ai-assistant/index.ts`:
- Fetch `membership.role` and `membership.data_scope` (already querying `tenant_members`, just need to select more columns)
- Add role-specific system prompt sections (similar to briefing's `roleSystemPrompts`) that shape the assistant's personality and focus areas per role
- Restrict tool availability by role:
  - `accountant` → prioritize `explain_account`, `query_tenant_data`, `forecast_cashflow`
  - `sales` → prioritize `get_partner_dossier`, pipeline queries
  - `hr` → payroll/employee focus, hide financial deep-dive tools
  - `store` → POS/inventory focus, hide accounting tools
  - `admin`/`super_admin`/`manager` → all tools
- Include `data_scope` in context so AI knows to filter appropriately

#### Step 2: Edge Function — Briefing `detectRole` alignment

Modify `supabase/functions/ai-executive-briefing/index.ts`:
- Replace fuzzy `detectRole()` string matching with direct use of the `app_role` enum value from `membership.role`
- Map enum values directly: `admin`→admin, `accountant`→accountant, `sales`→sales, `hr`→hr, `store`→warehouse, `manager`→manager, `user`→warehouse
- Keep super_admin fallback to admin prompt

#### Step 3: Frontend — Pass role to chat

Modify `src/hooks/useAiStream.ts`:
- Accept `role` in options, pass it in the request body to `ai-assistant`

Modify `src/components/ai/AiContextSidebar.tsx`:
- Read `role` from `useTenant()` and pass to `useAiStream`

#### Step 4: Role-filtered suggested questions

Modify `AiContextSidebar.tsx`:
- Filter `SUGGESTED_QUESTIONS` by role relevance (e.g., sales users don't see accounting questions on the dashboard, HR users see HR-focused prompts)

### Files to modify
- `supabase/functions/ai-assistant/index.ts` — role-aware prompt + tool filtering
- `supabase/functions/ai-executive-briefing/index.ts` — fix `detectRole`
- `src/hooks/useAiStream.ts` — pass role
- `src/components/ai/AiContextSidebar.tsx` — role-filtered suggestions

### Technical Details
- No database changes needed — all role data already exists in `tenant_members`
- Tool filtering is soft (AI instructions) not hard (tools still registered but prompt says "focus on X")
- Backward compatible: if role is not sent, defaults to current behavior


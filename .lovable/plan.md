

# Phase 2 Implementation Plan

## 5 Work Items

### 2A. CR8-07 — Rate-Limiting Middleware
Create `supabase/functions/_shared/rate-limiter.ts` with an in-memory sliding window rate limiter (Deno KV is not available in all edge function environments). Export a `checkRateLimit(key: string, limit: number, windowMs: number)` function that returns `{ allowed: boolean, remaining: number }`. Apply it to the most exposed functions: `ai-assistant`, `ai-insights`, `validate-pib`, `company-lookup`, and `web-order-import` by adding a rate check at the top of each handler, returning 429 via `createErrorResponse` if exceeded.

### 2B. CR8-08 — Paginated Tenant Data Export
Replace the `limit(10000)` in `tenant-data-export/index.ts` with cursor-based pagination per table. Accept an optional `?cursor` query param. For each table, paginate in 1000-row chunks using `.order("id").gt("id", lastId)`. If any table hits the limit, include a `truncated: true` flag and a `next_cursor` in the response so the client can resume. Update `DataExport.tsx` to handle multi-page exports by looping until no `next_cursor` remains, then merging results before download.

### 2C. CR8-10 — Incident Number Race Condition
The current code counts incidents client-side to generate `INC-YYYY/NNNN`, which races under concurrent inserts. Fix by:
1. **DB migration**: Create a Postgres sequence `incident_number_seq` and a trigger function `generate_incident_number()` that fires `BEFORE INSERT` on `incidents`, setting `incident_number = 'INC-' || EXTRACT(YEAR FROM NOW()) || '/' || LPAD(nextval('incident_number_seq')::text, 4, '0')`.
2. **Frontend**: Remove the manual `incident_number` generation from `IncidentManagement.tsx` — just omit the field and let the trigger handle it.

### 2D. CR9-02 — Audit USING(true) RLS Policies
Already resolved. Current `USING(true)` policies are SELECT-only on legitimate read-only catalog/lookup tables: `income_recipient_types`, `module_definitions`, `ovp_catalog`, `payment_models`, `popdv_tax_types`. No action needed.

### 2E. CR7-06 — AI Audit Logging Gaps
Three AI-prefixed functions are missing `ai_action_log` inserts: `ai-weekly-email`, `ai-year-end-check`, and `compliance-checker`. Also `document-ocr` (uses AI for OCR). For each, add an `await supabase.from("ai_action_log").insert({...})` call after the main AI operation completes, logging `tenant_id`, `user_id`, `action_type`, `module`, `model_version`, and `reasoning`.

---

## Summary

| Item | Type | Files Changed |
|------|------|---------------|
| 2A | New shared module + edits to 5 functions | `_shared/rate-limiter.ts`, 5 edge functions |
| 2B | Edge function + frontend | `tenant-data-export/index.ts`, `DataExport.tsx` |
| 2C | DB migration + frontend | New migration, `IncidentManagement.tsx` |
| 2D | No-op | Already resolved |
| 2E | Edge function edits | 4 edge functions |


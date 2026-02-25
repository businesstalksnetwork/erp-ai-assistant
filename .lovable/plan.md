

# Fix: AI Assistant Edge Function Crash

## Root Cause

In `supabase/functions/ai-assistant/index.ts`, line 52-54:

```typescript
await supabase.from("ai_rate_limits").insert({
  user_id: userId, tenant_id: tenantId, window_start: new Date().toISOString(),
}).catch(() => {});
```

The Supabase JS client's `.insert()` returns a `PostgrestFilterBuilder`, not a standard Promise. It does not have a `.catch()` method. This crashes the entire function before it even reaches the AI call.

## Fix

Replace `.catch(() => {})` with proper Supabase error handling pattern -- just ignore the error from the result object instead:

```typescript
await supabase.from("ai_rate_limits").insert({
  user_id: userId, tenant_id: tenantId, window_start: new Date().toISOString(),
});
```

Since we don't care about errors on this insert (it's non-critical rate limit tracking), simply removing `.catch()` is sufficient. The Supabase client swallows errors into `{ error }` without throwing.

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-assistant/index.ts` line 52-54 | Remove `.catch(() => {})` from rate limit insert |

One-line fix. No other files affected. Edge function will be redeployed automatically.


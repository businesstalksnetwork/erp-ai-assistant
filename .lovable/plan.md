

# Fix AI Analiza Not Loading in Sidebar

## Root Cause
In `AiContextSidebar.tsx` line ~156, the `AiAnalyticsNarrative` component receives `data={{}}` (an empty object). However, in `AiAnalyticsNarrative.tsx` line 26, the react-query has:

```typescript
enabled: !!tenantId && Object.keys(data).length > 0
```

Since `Object.keys({}).length === 0`, the query is permanently disabled and the AI narrative never loads.

## Fix

### File: `src/components/ai/AiContextSidebar.tsx`
Change `data={{}}` to pass a minimal context payload so the query fires:
```tsx
data={{ context: narrativeCtx, timestamp: Date.now() }}
```

Alternatively (and more cleanly), update the `enabled` condition in `AiAnalyticsNarrative.tsx` to not require non-empty data, since the edge function already receives the `context_type` which is sufficient to generate analysis.

### File: `src/components/ai/AiAnalyticsNarrative.tsx`
Change the enabled condition from:
```typescript
enabled: !!tenantId && Object.keys(data).length > 0
```
to:
```typescript
enabled: !!tenantId
```

And update the queryKey to not stringify empty data (to avoid unnecessary refetches):
```typescript
queryKey: ["ai-narrative", tenantId, contextType]
```

## Both changes ensure the AI Analysis section in the sidebar actually triggers the API call and displays the narrative.

### Technical Details
- Two files modified: `AiContextSidebar.tsx` (pass meaningful data) and `AiAnalyticsNarrative.tsx` (relax enabled condition)
- No new files or dependencies needed

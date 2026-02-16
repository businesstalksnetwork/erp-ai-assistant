

# Fix AI Chat 401 Unauthorized Error

## Root Cause
The `useAiStream` hook sends the Supabase **anon key** as the Authorization header:
```
Authorization: Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
```

But the edge function calls `getUser()` which requires the **user's session JWT token**. The anon key is not a valid user token, so authentication fails with 401.

## Fix

### File: `src/hooks/useAiStream.ts`
- Import the Supabase client to get the current user's session token
- Before making the fetch call, retrieve the session via `supabase.auth.getSession()`
- Use the session's `access_token` in the Authorization header instead of the anon key
- Add the `apikey` header with the anon key (required by Supabase edge functions)

### Changes:
```typescript
import { supabase } from "@/integrations/supabase/client";

// Inside the send function, before fetch:
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // show error: user not logged in
  return;
}

// In fetch headers:
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${session.access_token}`,
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
}
```

This ensures the edge function receives a valid user JWT for authentication, while the `apikey` header satisfies the Supabase gateway routing.

## Files Modified
- `src/hooks/useAiStream.ts` -- use user session token instead of anon key

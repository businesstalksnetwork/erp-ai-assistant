
# Fix: Auto-Clear Stale Auth Tokens for All Users

## The Real Problem

When Supabase fails to refresh a token (HTTP 400 "Refresh Token Not Found"), it fires a `TOKEN_REFRESH_FAILED` event through `onAuthStateChange`. The current code handles the null session case correctly (resets state), but it **does not clear the stale token data from localStorage**.

This means:
1. User opens app → stale token found in localStorage
2. Supabase tries to refresh it → fails with 400
3. App state resets correctly → user should go to `/auth`
4. BUT: the broken token **stays in localStorage**
5. Next time user opens app → same broken cycle repeats → infinite spinner again

The fix needs to **explicitly clear the Supabase auth session from localStorage** when a token refresh fails, so the broken token is gone for good.

## The Fix — `src/lib/auth.tsx` only

Add explicit handling for the `TOKEN_REFRESH_FAILED` event in `onAuthStateChange`:

```
TOKEN_REFRESH_FAILED event fires
  → call supabase.auth.signOut() to wipe localStorage token
  → state resets (profile null, isAdmin false, profileLoading false)
  → user gets redirected to /auth by ProtectedRoute
  → next app open: no stale token → clean load
```

### Code Change

In the `onAuthStateChange` callback, add a specific branch for `TOKEN_REFRESH_FAILED`:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // NEW: When token refresh fails, actively sign out to wipe the stale token
  if (event === 'TOKEN_REFRESH_FAILED') {
    supabase.auth.signOut(); // clears localStorage token
    setProfile(null);
    setIsAdmin(false);
    setProfileLoading(false);
    fetchingRef.current = false;
    setLoading(false);
    return; // stop here, don't process further
  }

  setSession(session);
  setUser(session?.user ?? null);
  // ... rest of existing logic
```

This is a one-line-of-defense change that ensures every user with a broken/expired token gets it automatically cleaned up the moment the app detects the failure — no manual action needed from any user.

## Why This Is Safe

- `supabase.auth.signOut()` in this context only clears localStorage — the user is already effectively signed out (their token was rejected by the server)
- It does NOT cause a loop — after `signOut()`, `onAuthStateChange` fires again with `SIGNED_OUT` + null session, which the existing null-session branch handles correctly
- The 5-second safety timeout in `App.tsx` (added in previous fix) still serves as a last resort

## Files Changed

| File | Change |
|------|--------|
| `src/lib/auth.tsx` | Add `TOKEN_REFRESH_FAILED` handler that calls `signOut()` to wipe stale localStorage token |

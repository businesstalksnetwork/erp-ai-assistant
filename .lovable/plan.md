
# Root Cause: Stale Sessions Not Triggering TOKEN_REFRESH_FAILED

## What the Data Shows

Both affected users have sessions created in January:
- `milenko23cabric`: session from Jan 22, token chain has been refreshing normally (revoked→new chain) — likely working now
- `rajicmont`: session from Jan 13, **last refreshed Feb 18** — the refresh token in their browser localStorage is from a revoked chain

The `TOKEN_REFRESH_FAILED` handler we added previously is the right approach, but there is a gap: **the Supabase JS client does not always fire `TOKEN_REFRESH_FAILED`** in scenarios where:
1. The tab has been in the background for a very long time
2. The user has the app open in multiple tabs (one tab refreshes the token, invalidating the other tab's token — a "refresh token rotation" conflict)
3. The page was restored from browser cache (bfcache) with a stale client state

## The Real Fix: Proactive Token Validation on App Load

Instead of *only* reacting to `TOKEN_REFRESH_FAILED`, we need to **proactively validate the session is still fresh** when `getSession()` returns a session. If the access token is expired or close to expiring, force a refresh upfront. If that fails, clear the stale token immediately.

### Changes to `src/lib/auth.tsx`

**1. Force token refresh on initial load**

In the `getSession()` callback, when a session exists, call `supabase.auth.refreshSession()` to proactively renew the token. If it fails, call `signOut()` immediately to clear the stale localStorage entry:

```typescript
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session) {
    setLoading(false);
    return;
  }
  
  // Check if access token is expired or about to expire (< 60 seconds left)
  const expiresAt = session.expires_at ?? 0;
  const nowSecs = Math.floor(Date.now() / 1000);
  const isExpiredOrExpiring = expiresAt - nowSecs < 60;
  
  if (isExpiredOrExpiring) {
    // Proactively refresh — if this fails, TOKEN_REFRESH_FAILED fires
    // If that also doesn't fire, the onAuthStateChange null-session branch handles it
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      // Force clear the stale token — don't wait for the event
      await supabase.auth.signOut();
      setLoading(false);
    }
    // onAuthStateChange will handle the new session if refresh succeeded
  }
  // If token is valid, onAuthStateChange handles it normally
});
```

**2. Add a "visibilitychange" listener to re-validate on tab focus**

When a user comes back to a tab after hours/days away, the app is still running but with a stale/dead token. We need to detect this and re-validate:

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && user) {
    // Re-validate session when tab becomes visible again
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // Session gone — clear state
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setProfileLoading(false);
      }
    });
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);
// cleanup in useEffect return
```

## Summary of File Changes

| File | Change |
|------|--------|
| `src/lib/auth.tsx` | Proactive token refresh check on initial `getSession()` call; add `visibilitychange` listener to re-validate session when user returns to a backgrounded tab |

## Why This Solves the Problem

The two affected users are stuck because:
1. Their browser has an old/invalid refresh token in localStorage
2. When they open the app, `getSession()` returns a session object (from localStorage) but the token is expired
3. The auto-refresh either hasn't fired yet or fails silently without triggering `TOKEN_REFRESH_FAILED`

By proactively calling `refreshSession()` at startup (and on tab focus), we catch this failure point explicitly and clear the stale data immediately — rather than waiting for an event that may never arrive.

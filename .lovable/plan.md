
# Fix: Revoke Stale Sessions + Enforce 24-Hour Login Requirement

## Current State

From the database analysis:

| Session Status | Sessions | Users |
|---|---|---|
| NEVER refreshed | 21 | 13 |
| Stale > 7 days | 17 | 17 |
| Stale 3-7 days | 6 | 6 |
| Stale 1-3 days | 2 | 2 |
| Active (< 1 day) | 10 | 9 |

The 13 users with sessions that have NEVER been refreshed (including users like `tihomir.azzure@gmail.com`, `doseze@yahoo.com`, `dragana@blink-blink.co.rs` etc.) are the next group that will hit the infinite spinner when they return to the app.

## Two-Part Fix

### Part 1: Delete All Stale Sessions from the Database (one-time cleanup)

Run a SQL command via the backend to delete all sessions that have not been refreshed for more than 24 hours. This forces every affected user to log in fresh the next time they open the app. Their stale localStorage tokens will then correctly get a 400 error → trigger our existing `TOKEN_REFRESH_FAILED` handler → clean redirect to login page.

```sql
-- Delete all sessions not refreshed in the last 24 hours
-- (sessions with NULL refreshed_at that are older than 24h are also deleted)
DELETE FROM auth.sessions
WHERE 
  (refreshed_at IS NULL AND created_at < NOW() - INTERVAL '24 hours')
  OR (refreshed_at IS NOT NULL AND refreshed_at < NOW() - INTERVAL '24 hours');
```

This is a one-time fix. After this, every user with a stale session will be forced to log in again. The existing app-side fixes (TOKEN_REFRESH_FAILED handler, proactive refresh on load) will cleanly redirect them to the login page instead of showing a spinner.

### Part 2: Enforce 24-Hour Session Lifetime Going Forward

The Supabase Auth project has a **JWT expiry** setting that controls how long an access token lives (default: 3600 seconds = 1 hour). But the session itself (the refresh token) can live much longer if users keep the app open.

To enforce 24-hour sessions going forward, there are two levers:

**Option A — Reduce refresh token reuse interval (recommended):** Set `refresh_token_reuse_interval` to 0 and `jwt_expiry` to 86400 (24 hours). This means the access token is valid for 24 hours and will attempt to refresh after that — if the user is inactive for more than 24 hours, their session expires.

**Option B — Client-side enforcement:** Store a `login_at` timestamp in `localStorage` when the user signs in. On each app load, check if more than 24 hours have passed since login. If yes, call `signOut()` and redirect to login.

Option B is implemented in `src/lib/auth.tsx` because it does not require changing Supabase server settings (which may not be accessible):

In the `onAuthStateChange` handler, when a new session is received with a `SIGNED_IN` event, store `Date.now()` to `localStorage` as `pausalbox_login_at`. Then in the `getSession()` check at startup, compare against this timestamp — if more than 24 hours have passed, call `signOut()`.

## Files Changed

| File | Change |
|------|--------|
| Backend (SQL) | Delete all sessions not refreshed in 24+ hours (one-time cleanup via SQL query) |
| `src/lib/auth.tsx` | Add 24-hour client-side session enforcement: store login timestamp on `SIGNED_IN`, check on startup and tab focus |

## Implementation Steps

1. **Run SQL cleanup** (via database query tool) to delete all stale sessions immediately — this fixes all currently affected users
2. **Update `src/lib/auth.tsx`** to enforce 24-hour session limit client-side going forward

## What Users Will Experience

- Users with stale sessions: next time they open the app, they will see the login page (clean redirect, no spinner)
- Active users: no interruption — their sessions are still valid
- Going forward: after 24 hours of inactivity, any user will be redirected to login automatically

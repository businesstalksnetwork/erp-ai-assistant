
# Fix: App Stuck on Loading Spinner (Infinite Spinner Bug)

## Root Cause

The console logs reveal the exact problem:

```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found (HTTP 400)
```

When a user has an **expired or invalid session token** stored in their browser (common after being away from the app for a while, clearing cookies partially, or switching devices), the following broken sequence happens:

1. App starts → `loading = true` (spinner shows)
2. `supabase.auth.getSession()` and `onAuthStateChange` both run in parallel
3. The Supabase client tries to **refresh the expired token** — this takes time (network call)
4. During this waiting period, `profileLoading` gets set to `true` inside `fetchProfile`
5. The token refresh **fails** (400 error), Supabase signs the user out
6. `onAuthStateChange` fires with `null` session → `setLoading(false)` 
7. BUT: `profileLoading` may still be `true` from an earlier `fetchProfile` call
8. The spinner condition `loading || (profileLoading && !profile)` → `false || (true && true)` = **`true`** → **infinite spinner**

Additionally, `fetchProfile` can be called **twice** (once from `getSession`, once from `onAuthStateChange`) creating a race condition where `profileLoading` gets stuck at `true`.

## The Fix (2 files)

### 1. `src/lib/auth.tsx` — Fix the race condition

**Problem areas:**
- `fetchProfile` is called from both `getSession()` and `onAuthStateChange` simultaneously
- If token refresh fails and user is signed out, `profileLoading` may never reset to `false` if `fetchProfile` was mid-execution
- No error handling for failed session refresh

**Changes:**
- Add a `fetchingRef` (useRef) to prevent duplicate `fetchProfile` calls
- In `onAuthStateChange`: when event is `SIGNED_OUT` or session is null, **always** reset `profileLoading` to `false` explicitly
- Remove the duplicate `fetchProfile` call from `getSession()` — `onAuthStateChange` already handles this (it fires for every session change including the initial one)
- Add a `TOKEN_REFRESHED` and `SIGNED_OUT` handler in `onAuthStateChange` to properly reset state

### 2. `src/App.tsx` — Make spinner timeout-safe

**Change:**
- Add a maximum loading timeout (5 seconds) — if after 5s the app is still in loading state but `user` is `null`, force `loading = false` to avoid permanent spinner

## Technical Summary of Changes

```text
src/lib/auth.tsx
├── Remove fetchProfile() call from getSession() callback (onAuthStateChange handles it)
├── Add explicit profileLoading = false reset when session is null in onAuthStateChange  
└── Add fetchingRef to prevent double fetchProfile calls

src/App.tsx  
└── Add 5-second safety timeout to exit loading state
```

This fixes the infinite spinner that users experience when:
- Their refresh token has expired (most common case)
- They return to the app after a long time away
- They switch between networks on mobile
- The token refresh call takes too long or fails

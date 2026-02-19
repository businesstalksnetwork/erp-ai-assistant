

# Fix Mobile Loading Issue - Stuck Spinner

## Problem

On mobile, the app shows the dashboard briefly, then a loading spinner appears and **stays permanently**. The root cause is a race condition in `src/lib/auth.tsx` and a missing safety timeout in `src/App.tsx`.

### What Happens Step by Step

1. User opens app on mobile
2. `onAuthStateChange` fires -- sets `loading = false`
3. `fetchProfile` runs in `setTimeout(0)` -- sets `profileLoading = true`
4. On slow mobile network, the profile query takes too long or silently fails
5. `AppRoutes` keeps showing the spinner forever (no timeout like `ProtectedRoute` has)

Additionally, there is a brief gap between step 2 and 3 where `loading = false`, `profile = null`, and `profileLoading = false`. During this gap the app thinks the user is not verified and redirects them, creating a flash.

## Solution (2 files)

### 1. `src/lib/auth.tsx` - Keep loading until profile is fetched

Instead of setting `loading = false` as soon as `onAuthStateChange` fires and then separately fetching the profile, keep `loading = true` until the profile fetch completes on the initial load. This eliminates the gap entirely.

- Add an `initialLoadRef` to track whether the first profile fetch has completed
- Only set `loading = false` after the first `fetchProfile` completes (or if there is no session)
- Move `setLoading(false)` into `fetchProfile`'s `finally` block for the initial load

### 2. `src/App.tsx` - Add safety timeout to `AppRoutes`

Add the same 5-second safety timeout that `ProtectedRoute` already has. If `profileLoading && !profile` stays stuck beyond 5 seconds, stop showing the spinner and let the route logic handle the state.

## Technical Details

### `src/lib/auth.tsx`

```text
Changes:
- Add: const initialLoadDoneRef = useRef(false);
- Modify fetchProfile to accept an `isInitialLoad` flag
- When isInitialLoad is true, call setLoading(false) in the finally block
- In onAuthStateChange: pass isInitialLoad=!initialLoadDoneRef.current
- Set initialLoadDoneRef.current = true after first profile fetch
- In getSession() no-session path: also set initialLoadDoneRef.current = true
```

### `src/App.tsx`

```text
Changes:
- Add a timedOut state + 5s timeout in AppRoutes (identical pattern to ProtectedRoute)
- Change spinner condition to: (loading || (profileLoading && !profile)) && !timedOut
```

This ensures the app never shows an infinite spinner on mobile, while also preventing the flash caused by the brief gap where profile is null.


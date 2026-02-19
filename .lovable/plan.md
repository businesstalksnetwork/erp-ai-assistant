
# Add Session Expiry Toast Notification

## What Changes

One file only: `src/lib/auth.tsx`

The standalone `toast` function from `sonner` will be imported and called at each of the 4 places where the app automatically signs a user out due to a stale or expired session. This works because `sonner`'s `toast()` is a standalone function (not a React hook) and can be called from anywhere — including inside context providers.

## The 4 Auto-Logout Points

| # | Location | Trigger |
|---|---|---|
| 1 | `onAuthStateChange` | `TOKEN_REFRESH_FAILED` event |
| 2 | `getSession()` on app load | 24-hour login limit exceeded |
| 3 | `getSession()` on app load | Token expired, refresh attempt failed |
| 4 | `visibilitychange` handler | 24-hour limit exceeded on tab focus |

A helper flag `sessionExpiredToastShown` (a `useRef` boolean) will be used to prevent the toast from firing multiple times in rapid succession (e.g. if both the `getSession` check and the `onAuthStateChange` event fire close together).

## Code Change

**Import addition** at the top of `src/lib/auth.tsx`:
```typescript
import { toast } from 'sonner';
```

**Helper ref** inside `AuthProvider` (next to the existing `fetchingRef`):
```typescript
const sessionExpiredToastRef = useRef(false);
```

**Helper function** inside `AuthProvider`:
```typescript
const showSessionExpiredToast = () => {
  if (!sessionExpiredToastRef.current) {
    sessionExpiredToastRef.current = true;
    toast.error('Vaša sesija je istekla, molimo prijavite se ponovo', {
      duration: 6000,
    });
  }
};
```

**Called at all 4 auto-logout points**, for example:
```typescript
// TOKEN_REFRESH_FAILED
if ((event as string) === 'TOKEN_REFRESH_FAILED') {
  showSessionExpiredToast(); // <-- added
  supabase.auth.signOut();
  ...
}

// 24-hour limit on load
if (loginAt && Date.now() - parseInt(loginAt) > twentyFourHours) {
  showSessionExpiredToast(); // <-- added
  await supabase.auth.signOut();
  ...
}

// Refresh failed
if (error) {
  showSessionExpiredToast(); // <-- added
  await supabase.auth.signOut();
  ...
}

// visibilitychange 24-hour limit
if (loginAt && Date.now() - parseInt(loginAt) > twentyFourHours) {
  showSessionExpiredToast(); // <-- added
  supabase.auth.signOut();
  ...
}
```

The ref resets to `false` when the user successfully signs in (`SIGNED_IN` event), so the toast can appear again on the next session expiry.

## Technical Details

- `sonner`'s `toast` is already used across the entire app and the `<Sonner />` toaster is mounted in `App.tsx` — no new setup needed
- `toast.error()` gives a red/destructive styling appropriate for a session expiry message
- The 6-second duration ensures users have time to read the message before it fades
- The deduplication ref prevents double-toasting when multiple signals fire simultaneously

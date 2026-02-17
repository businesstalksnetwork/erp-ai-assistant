

# Hide Sidebar Items When Subscription Expired + Stop Notifications for Expired Users

## Problem

1. When a user's subscription is expired, the sidebar still shows all navigation items (Fakture, KPO, Podsetnici, etc.) even though they can't access them (they get redirected to /profile).
2. The edge function `send-notification-emails` sends reminder emails and push notifications to users with expired subscriptions, which is unnecessary and potentially confusing.

## Changes

### 1. `src/components/AppLayout.tsx` - Hide sidebar items for expired users

When `isSubscriptionExpired` is true (and user is not admin/bookkeeper):
- **Sidebar**: Show only "Moja Kompanija" (`/companies`) and hide all main nav items, bookkeeping, and admin sections
- **Mobile bottom nav**: Show only "Profil" (`/profile`) tab and the "More" menu button (which opens the reduced sidebar)
- Hide the Company Selector since they can't do anything with it
- Hide the bookkeeper quick access section

The `getFilteredNavItems` function will return empty `main` and `adminGroup` arrays when expired, and `profileGroup` will only contain the company item.

### 2. `supabase/functions/send-notification-emails/index.ts` - Skip expired users

Add a check at the start of the per-company loop: if the user's `subscription_end` is in the past and they are not a bookkeeper, skip them entirely. This prevents:
- Reminder emails for payment due dates
- Limit warning emails
- In-app notifications
- Push notifications

The subscription expiry emails themselves will still be sent (they warn about upcoming expiry before it happens, so the user's sub is still active at that point).

### 3. `src/hooks/useNotifications.ts` - Skip client-side notifications for expired users

The hook currently shows browser notifications and toasts for reminders and limits regardless of subscription status. Add a check to bail out early if the subscription is expired (no reminders, no limit warnings shown client-side).

## Technical Details

### AppLayout.tsx changes

In `getFilteredNavItems()`, check `isSubscriptionExpired`:
```typescript
const getFilteredNavItems = () => {
  if (isSubscriptionExpired && !isAdmin && !isBookkeeper) {
    const companyLabel = myCompanies.length > 1 ? 'Moje Kompanije' : 'Moja Kompanija';
    return {
      main: [],
      profileGroup: [{ href: '/companies', label: companyLabel, icon: Building2 }],
      adminGroup: [],
    };
  }
  // ... existing logic
};
```

For mobile bottom nav, filter to only show Profile when expired:
```typescript
const activeMobileItems = (isSubscriptionExpired && !isAdmin && !isBookkeeper)
  ? [{ href: '/profile', label: 'Profil', icon: User }]
  : mobileBottomNavItems;
```

Hide Company Selector and Bookkeeper section when expired.

### Edge function changes

After fetching the profile, add:
```typescript
// Skip users with expired subscriptions (except bookkeepers)
if (profile.account_type !== 'bookkeeper' && profile.subscription_end) {
  const subEnd = new Date(profile.subscription_end);
  if (subEnd.getTime() < today.getTime()) continue;
}
```

This `continue` skips the entire company iteration for expired users, preventing all notification types.

### useNotifications.ts changes

Import `useAuth` and check `isSubscriptionExpired` to skip all notification logic when expired.

## Summary

Three files modified:
- `src/components/AppLayout.tsx` -- hide nav items in sidebar and mobile bar when expired
- `supabase/functions/send-notification-emails/index.ts` -- skip expired users entirely
- `src/hooks/useNotifications.ts` -- skip client-side notifications for expired users

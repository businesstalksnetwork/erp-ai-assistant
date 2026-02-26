

# Redesign Notification Preferences: Per-Category Channel Control

## Current State
- **notification_preferences** table: simple `category + enabled` toggle (on/off per category, no channel distinction)
- **Push infrastructure**: Edge function code exists for web push (`push_subscriptions`) and native push (`native_push_tokens`), but **neither table exists in the database**, and `profiles` has no `push_notifications_enabled` column
- **VAPID key endpoint**: `get-vapid-public-key` edge function exists but no client-side service worker or subscription logic
- **UI**: Simple list of switches — one per category, no channel selection

## Proposed Design

Replace the single toggle per category with a **matrix UI**: each category row has 3 channel toggles (In-App, Push, Email).

```text
                        In-App    Push     Email
  ──────────────────────────────────────────────
  Fakture (Invoice)      [✓]      [✓]      [ ]
  Inventar (Inventory)   [✓]      [ ]      [ ]
  Odobrenja (Approval)   [✓]      [✓]      [✓]
  HR                     [✓]      [ ]      [ ]
  Računovodstvo          [✓]      [✓]      [ ]
```

Plus a **global push toggle** at the top that requests browser permission and registers the service worker subscription.

## Changes

### 1. Database Migration
- Add columns to `notification_preferences`:
  - `in_app_enabled BOOLEAN DEFAULT true`
  - `push_enabled BOOLEAN DEFAULT true`
  - `email_enabled BOOLEAN DEFAULT false`
- Migrate existing `enabled` data into `in_app_enabled` (preserve current settings)
- Create `push_subscriptions` table (id, user_id, tenant_id, endpoint, p256dh, auth, created_at) with RLS
- Add `push_notifications_enabled BOOLEAN DEFAULT false` to `profiles`

### 2. Service Worker + Push Subscription (`src/lib/pushSubscription.ts`)
- Request notification permission from browser
- Register service worker, subscribe with VAPID public key from `get-vapid-public-key` edge function
- Save subscription to `push_subscriptions` table
- Unsubscribe helper

### 3. Service Worker File (`public/sw.js`)
- Listen for `push` events, show notification with title/message/link from payload
- Handle `notificationclick` to open the app at the correct route

### 4. Redesign `NotificationPreferences.tsx`
- Matrix layout: rows = categories, columns = In-App / Push / Email (using Checkbox components)
- Global push toggle at top that triggers browser permission + subscription
- Each cell upserts `notification_preferences` with the specific channel column
- Add translations: `inAppChannel`, `pushChannel`, `emailChannel`, `enablePushNotifications`, `pushNotificationsDescription`

### 5. Update `translations.ts`
- Add ~6 new translation keys for the channel labels and push toggle descriptions

### 6. Update Edge Function (`send-notification-emails/index.ts`)
- When sending notifications, check the per-channel preferences (`in_app_enabled`, `push_enabled`, `email_enabled`) instead of the single `enabled` flag
- Query `notification_preferences` with category + user_id to decide which channels to use


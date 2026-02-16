

# Plan: Trackable Invoice Links, In-App Notification System, and App Header

## Overview
Three interconnected features: (1) Make invoice PDF links trackable so you know when a client opens/views the invoice, (2) Build a persistent in-app notification system stored in the database, (3) Redesign the app layout to include a top header bar with notifications bell and user profile section.

---

## Part 1: Trackable Invoice PDF Links

### How it works
Instead of sending the direct PDF URL in the email, we send a tracking URL that goes through our backend function. When the client clicks the link, the function:
1. Records the "view" event (timestamp, IP, user-agent)
2. Redirects the client to the actual PDF URL
3. Creates an in-app notification for the invoice owner: "Klijent je pogledao fakturu X"

### Database changes

**New table: `invoice_views`**
- `id` (UUID, PK)
- `invoice_id` (UUID, FK to invoices)
- `company_id` (UUID, FK to companies)
- `email_log_id` (UUID, FK to invoice_email_log, nullable)
- `tracking_token` (TEXT, UNIQUE) - random token for the tracking URL
- `pdf_url` (TEXT) - the actual signed PDF URL
- `pdf_url_expires_at` (TIMESTAMPTZ) - when the signed URL expires
- `viewed_at` (TIMESTAMPTZ, nullable) - first view timestamp
- `view_count` (INT, default 0) - total views
- `last_viewed_at` (TIMESTAMPTZ, nullable)
- `viewer_ip` (TEXT, nullable)
- `viewer_user_agent` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, default now())

RLS: No RLS needed since this table is accessed by edge functions with service role key. For frontend reads, add policy for authenticated users to read rows where `company_id` matches their companies.

### New edge function: `track-invoice-view`
- Accepts GET request with `?token=<tracking_token>`
- Looks up the `invoice_views` record by token
- Updates `viewed_at` (if first view), increments `view_count`, sets `last_viewed_at`
- Creates a notification in the `notifications` table
- Redirects (HTTP 302) to the actual PDF URL
- If token expired or not found, shows a simple error page

### Changes to `send-invoice-email` edge function
- After sending email successfully, create an `invoice_views` record with a random tracking token
- Replace `{{pdf_url}}` in template data with the tracking URL: `https://<supabase-url>/functions/v1/track-invoice-view?token=<token>`

---

## Part 2: In-App Notification System

### Database changes

**New table: `notifications`**
- `id` (UUID, PK)
- `user_id` (UUID, references profiles.id)
- `company_id` (UUID, nullable)
- `type` (TEXT) - e.g. 'invoice_viewed', 'reminder_due', 'limit_warning', 'subscription_expiring'
- `title` (TEXT)
- `message` (TEXT)
- `link` (TEXT, nullable) - where to navigate on click
- `reference_id` (TEXT, nullable) - e.g. invoice ID
- `is_read` (BOOLEAN, default false)
- `created_at` (TIMESTAMPTZ, default now())

RLS: Users can only read/update their own notifications (`user_id = auth.uid()`).

### New hook: `useAppNotifications`
- Fetches unread notifications count and list from the `notifications` table
- Uses realtime subscription (via Supabase Realtime) to get instant updates when new notifications arrive
- Provides `markAsRead(id)`, `markAllAsRead()`, and `dismissNotification(id)` functions

### How notifications get created
- **Invoice viewed**: The `track-invoice-view` edge function creates a notification for the invoice owner
- Future: Other notification types can be added (reminders, limits, etc.)

---

## Part 3: App Header with Notifications and User Profile

### Layout redesign
Currently the app has only a sidebar. We'll add a fixed top header bar (on desktop) that contains:

```
[Page breadcrumb/title]                    [Bell icon + badge]  [User name + role + chevron]
```

- **Left side**: Empty or page context (optional)
- **Right side**: 
  - Notification bell icon with unread count badge
  - User profile section (like the screenshot): Name + Role, clicking opens dropdown with same options as current sidebar dropdown (change password, theme toggle, sign out)

### Notification dropdown
Clicking the bell opens a dropdown/popover showing:
- List of recent notifications (last 20)
- Each item shows: icon, title, message, time ago
- Click on a notification marks it as read and navigates to the link
- "Oznaci sve kao procitane" (Mark all as read) button at the top
- Unread items have a blue dot indicator

### Changes to `AppLayout.tsx`
- Add a `<header>` element between sidebar and main content area
- On desktop: fixed top bar starting at `left: 256px` (sidebar width)
- On mobile: integrated into existing mobile header
- Move user dropdown from sidebar bottom to the header right side
- Keep sidebar navigation as-is (without the bottom user section)

### Files involved
- `src/components/AppLayout.tsx` - Add header, move user section
- `src/components/NotificationBell.tsx` - New component for bell + dropdown
- `src/hooks/useAppNotifications.ts` - New hook for notification data

---

## Technical Details

### Database migration SQL
```
-- Invoice view tracking
CREATE TABLE invoice_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  company_id UUID REFERENCES companies(id),
  email_log_id UUID REFERENCES invoice_email_log(id),
  tracking_token TEXT UNIQUE NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_url_expires_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- In-app notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  reference_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS
ALTER TABLE invoice_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company invoice views"
  ON invoice_views FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());
```

### Edge function: `track-invoice-view`
- GET handler that reads `token` query param
- Looks up `invoice_views` by `tracking_token`
- Updates view stats
- Finds the invoice owner (via `invoices.company_id` -> `companies.user_id`)
- Inserts a notification for that user
- Returns HTTP 302 redirect to `pdf_url`

### Changes to `send-invoice-email`
- After successful email send and log insert, generate a `tracking_token` (crypto.randomUUID())
- Insert into `invoice_views` with the token and original `pdfUrl`
- Build tracking URL and use it as `pdf_url` in template data

### New component: `NotificationBell`
- Uses `useAppNotifications` hook
- Renders Bell icon with badge count
- Popover with scrollable notification list
- Each notification: icon based on type, title, message, relative time
- Click marks as read and navigates

### `AppLayout.tsx` changes
- Add fixed header bar at top (h-14, bg-card, border-bottom)
- Desktop: `left-64`, right-0, z-30
- Contains: notification bell (right), user dropdown (far right)
- User dropdown shows name + role like screenshot, with chevron
- Remove user section from sidebar bottom
- Adjust main content padding to account for header height

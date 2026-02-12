

# Phase 11: Notifications & In-App Alerts System

Add a real-time notification system that surfaces important events to users as they happen -- overdue invoices, pending approvals, low stock warnings, and completed actions. This is a critical step toward production readiness, giving users timely awareness without requiring them to check each module individually.

---

## What Gets Built

### 1. Notifications Infrastructure
A centralized notification system that captures events from across all modules and delivers them to the right users within a tenant.

### 2. Notification Bell & Dropdown
A bell icon in the top header bar showing unread count badge and a dropdown panel listing recent notifications, with mark-as-read and link-to-source functionality.

### 3. Automatic Notification Triggers
Event-driven notifications generated from existing module events:
- **Invoices**: Invoice overdue, invoice paid, new invoice received
- **Approvals**: Approval requested, approval granted/rejected
- **Inventory**: Stock below minimum level, stock-out detected
- **Returns**: Return case created, return approved
- **HR**: Leave request submitted, leave approved/rejected
- **Accounting**: Journal entry posted, fiscal period closing reminder

---

## Database (1 migration, 2 tables)

| Table | Purpose |
|-------|---------|
| `notifications` | tenant_id, user_id (recipient), type (info/warning/action), category (invoice/inventory/approval/hr/accounting), title, message, entity_type, entity_id (link to source record), is_read (default false), created_at |
| `notification_preferences` | tenant_id, user_id, category, enabled (boolean), created_at -- allows users to mute specific notification categories |

Both tables with RLS scoped to tenant_id and user_id for the recipient's own notifications.

---

## Edge Function: `create-notification`

A lightweight utility function called from `process-module-event` handlers to insert notification records:
- Receives: tenant_id, target_user_ids (or "all_tenant_members"), type, category, title, message, entity_type, entity_id
- Inserts one notification row per recipient
- Returns count of notifications created

---

## Frontend

### New Components

| Component | Description |
|-----------|-------------|
| `NotificationBell.tsx` | Bell icon with unread count badge in the header; opens dropdown on click |
| `NotificationDropdown.tsx` | Scrollable list of recent notifications with severity icons, timestamps, mark-as-read, and click-to-navigate |
| `NotificationPreferences.tsx` | Settings page section for toggling notification categories on/off |

### Modified Pages/Layouts

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Add NotificationBell to header bar next to LanguageToggle |
| `src/pages/tenant/Settings.tsx` | Add notification preferences card |

---

## Event Bus Integration

Update `process-module-event` to emit notifications for key events:

| Event | Notification |
|-------|-------------|
| `invoice.overdue` (new trigger) | Warning: "Invoice #X is overdue by Y days" to invoice owner |
| `approval.requested` | Action: "Approval requested for [entity]" to designated approvers |
| `approval.completed` | Info: "Your [entity] has been approved/rejected" to requester |
| `inventory.low_stock` (new trigger) | Warning: "Product X is below minimum stock level" to all tenant members |
| `return_case.approved` | Info: "Return case #X has been approved" to case creator |
| `leave_request.submitted` | Action: "New leave request from [employee]" to HR managers |

---

## Realtime Subscriptions

Use Supabase Realtime to subscribe to the `notifications` table filtered by user_id, so new notifications appear instantly without page refresh. The NotificationBell component will:
- Subscribe on mount
- Increment the unread badge counter on new inserts
- Show a subtle toast for high-priority (warning/action) notifications

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/..._notifications.sql` | 2 tables, RLS, indexes |
| `supabase/functions/create-notification/index.ts` | Notification creation utility |
| `src/components/notifications/NotificationBell.tsx` | Header bell with badge |
| `src/components/notifications/NotificationDropdown.tsx` | Notification list dropdown |
| `src/components/notifications/NotificationPreferences.tsx` | Category toggle settings |
| `src/hooks/useNotifications.ts` | Hook for fetching, subscribing, and managing notifications |

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Add NotificationBell to header |
| `src/pages/tenant/Settings.tsx` | Add notification preferences card |
| `src/i18n/translations.ts` | Add EN/SR keys for notifications |
| `supabase/functions/process-module-event/index.ts` | Add notification emission for key events |
| `supabase/config.toml` | Register create-notification function |

---

## i18n Keys

- Module labels: notifications, notificationPreferences, markAllRead, noNotifications
- Categories: invoiceNotifications, inventoryNotifications, approvalNotifications, hrNotifications, accountingNotifications
- Messages: invoiceOverdue, approvalRequested, stockBelowMinimum, returnApproved, leaveRequestSubmitted

---

## Technical Notes

- Notifications are stored permanently but the dropdown shows only the last 50; a "View All" link could lead to a full notification page in a future phase
- Realtime subscription uses Supabase's `postgres_changes` channel filtered by `user_id = auth.uid()`
- Notification preferences default to all-enabled; users opt out per category
- The `create-notification` edge function is called internally by `process-module-event`, not directly from the frontend
- High-priority notifications (type = "warning" or "action") trigger a sonner toast in addition to the bell badge
- Entity links (entity_type + entity_id) allow click-to-navigate directly to the relevant record


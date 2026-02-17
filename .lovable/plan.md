
# Prevent Duplicate Bulk Emails + Fix Logging

## Problem

Two issues prevent deduplication:
1. **Logging is broken**: `company_id` is `NOT NULL` with a foreign key constraint, so inserting with a dummy UUID fails silently. No bulk email sends are ever recorded.
2. **No dedup check**: The function sends to everyone in the list regardless of prior sends.

Since some users were already emailed last week (manually or via the automated `trial_expiring` notifications), we need to check both `admin_bulk_*` logs AND the existing `trial_expiring_1d` notifications (which indicate the trial already expired).

## Changes

### 1. Database Migration: Make `company_id` nullable

```sql
ALTER TABLE email_notification_log ALTER COLUMN company_id DROP NOT NULL;
```

This allows logging admin bulk emails that aren't tied to a specific company.

### 2. Edge Function: `send-admin-bulk-email/index.ts`

- **Fix logging**: Use `null` for `company_id` instead of the dummy UUID
- **Add deduplication**: Before the send loop, query `email_notification_log` for:
  - Any `admin_bulk_{templateKey}` entries (previous bulk sends)
  - Any `trial_expiring_1d` entries (the automated "your trial expired" email -- these users already know)
- Build a Set of already-notified emails, filter them out
- Return `skipped` count in the response

### 3. Frontend: `AdminPanel.tsx`

- Update the toast to show skipped count: "Poslato: X. Preskoceno: Y. Greske: Z."

## Technical Details

### Edge function deduplication logic

```typescript
const notificationType = "admin_bulk_" + templateKey;

// Fetch emails already sent for this bulk template OR via trial_expiring_1d
const { data: alreadySent } = await supabase
  .from("email_notification_log")
  .select("email_to")
  .or(`notification_type.eq.${notificationType},notification_type.eq.trial_expiring_1d`);

const sentSet = new Set((alreadySent || []).map(r => r.email_to));
const toSend = recipients.filter(r => !sentSet.has(r.email));
const skipped = recipients.length - toSend.length;

// Loop only over toSend
// Log with company_id: null
```

### AdminPanel.tsx toast update

```typescript
description: `Poslato: ${data.sent}. Preskočeno: ${data.skipped || 0}. Greške: ${data.errors}.`
```

## Files Modified

- **Migration**: Make `company_id` nullable on `email_notification_log`
- **`supabase/functions/send-admin-bulk-email/index.ts`**: Add dedup + fix logging
- **`src/pages/AdminPanel.tsx`**: Show skipped count in toast

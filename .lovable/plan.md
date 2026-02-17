

# Bulk Email Selection Dialog with Last Contact Info

## Overview

Replace the current simple "Are you sure?" confirmation dialog with a full dialog showing a table of all expired trial users. Each row will have a checkbox for selection and a column showing when the user was last contacted regarding subscription. You can select/deselect individual users before sending.

## What you will see

- Clicking "Posalji mail svima" opens a larger dialog with a scrollable table
- Table columns: Checkbox, Ime, Email, Poslednji kontakt (last subscription-related email date)
- "Selektuj sve" / "Deselektuj sve" toggle at the top
- Users who were already contacted show the date in the "Poslednji kontakt" column
- Send button shows count of selected users
- Deduplication still happens server-side as a safety net

## Technical Details

### New component: `src/components/BulkEmailDialog.tsx`

A Dialog component that:
1. Receives the list of `filteredUsers` as props
2. On open, fetches `email_notification_log` for all subscription-related notification types (`admin_bulk_%`, `trial_expiring_%`) grouped by `email_to` with `MAX(created_at)` to get last contact date
3. Renders a scrollable table with checkboxes, user info, and last contact date
4. Has select all / deselect all functionality
5. On "Posalji", calls the existing edge function with only the selected recipients

### Changes to `src/pages/AdminPanel.tsx`

- Import and use the new `BulkEmailDialog` component
- Remove the old `AlertDialog` for bulk email confirmation
- Pass `filteredUsers`, open state, and the send handler to the new component

### Data query for last contact

```sql
SELECT email_to, MAX(created_at) as last_contacted
FROM email_notification_log
WHERE notification_type LIKE 'admin_bulk_%' 
   OR notification_type LIKE 'trial_expiring_%'
GROUP BY email_to
```

This query runs client-side when the dialog opens, matching each user's email to their last contact date.

### Files

- **Create**: `src/components/BulkEmailDialog.tsx` -- new dialog component with selection table
- **Edit**: `src/pages/AdminPanel.tsx` -- replace AlertDialog with the new BulkEmailDialog, remove old bulk email dialog code

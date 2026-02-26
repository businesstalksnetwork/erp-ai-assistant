

# Plan: Revers Signature Workflow & Email Notifications

## Gaps Identified

1. **No employee-facing signature flow** — currently any logged-in user can "sign" a revers via the admin UI. There's no token-based signature request that an employee can complete (even without a system account).
2. **No rejection flow** — `rejection_reason` column exists in `asset_reverses` but the UI has no reject button or reason dialog.
3. **No email notifications** — Resend is already integrated in 4 other edge functions (`send-notification-emails`, `send-invoice-email`, `send-verification-email`, `send-admin-bulk-email`) but **`RESEND_API_KEY` is NOT in secrets** (missing from vault). Employees have an `email` column in the DB.
4. **No signature token mechanism** — no way for an employee to sign via a unique link without logging in.
5. **No audit trail for signature events** — `signed_at` and `signed_by_name` exist, but no event log.

## Database Changes

**Migration: Add signature token & tracking columns to `asset_reverses`**

```sql
ALTER TABLE asset_reverses 
  ADD COLUMN IF NOT EXISTS signature_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS signature_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_signed_by_name text,
  ADD COLUMN IF NOT EXISTS employee_signature_ip text,
  ADD COLUMN IF NOT EXISTS issuer_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS issuer_signed_by_name text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_reverses_signature_token 
  ON asset_reverses(signature_token) WHERE signature_token IS NOT NULL;
```

## Implementation Tasks

### Task 1: Edge Function `send-revers-notification`

New edge function that:
- Accepts `{ revers_id, tenant_id, action: "request_signature" | "reminder" | "signed" | "rejected" }`
- Looks up the revers, employee email, asset details, tenant name
- Sends email via Resend with:
  - **request_signature**: includes a unique signing link with `signature_token`
  - **reminder**: follow-up for unsigned reverses
  - **signed/rejected**: confirmation to the issuer
- Updates `notification_sent_at` / `reminder_sent_at` on the revers record
- Requires `RESEND_API_KEY` secret to be added

### Task 2: Public Signature Page `/sign/:token`

New route + page `ReversSignature.tsx`:
- Publicly accessible (no auth required)
- Looks up `asset_reverses` by `signature_token` where `token_expires_at > now()`
- Shows revers details (asset, date, condition, accessories) in read-only
- Employee can **Sign** (captures name, IP, timestamp) or **Reject** (with reason)
- On sign: updates `status = 'signed'`, `employee_signed_at`, `employee_signed_by_name`, `employee_signature_ip`
- On reject: updates `status = 'rejected'`, `rejection_reason`
- Triggers notification email back to issuer

### Task 3: Update AssetReverses.tsx UI

- **Send for Signature** button: now calls `send-revers-notification` edge function (sends email with signing link) instead of just updating status
- **Reject** button for `pending_signature` status with reason dialog
- **Reminder** button for `pending_signature` reverses older than X days
- **Status column**: show `notification_sent_at` timestamp as tooltip
- **Detail/Preview dialog**: view full revers details inline

### Task 4: Add `RESEND_API_KEY` Secret

- Prompt user to add `RESEND_API_KEY` to edge function secrets (it's used by 4 existing functions but is currently missing from vault)

### Task 5: Translations

~15 new keys: signature request email subjects, signing page labels, rejection reason prompt, reminder sent confirmation.

## Affected Files

- **New**: `supabase/functions/send-revers-notification/index.ts`
- **New**: `src/pages/tenant/ReversSignature.tsx` (public page)
- **Modified**: `src/pages/tenant/AssetReverses.tsx` (reject flow, reminder, email trigger)
- **Modified**: `src/routes/assetsRoutes.tsx` (public sign route)
- **Modified**: `src/i18n/translations.ts`
- **Database**: 1 migration (signature token columns)

## Flow Summary

```text
Admin creates revers (draft)
  → Clicks "Send for Signature"
    → Edge function sends email to employee with /sign/{token} link
    → Status: pending_signature, notification_sent_at set
  → Employee opens link (no login needed)
    → Reviews asset details
    → Signs → status: signed, email sent to admin
    → Rejects → status: rejected + reason, email sent to admin
  → Admin can send reminder if no response
```


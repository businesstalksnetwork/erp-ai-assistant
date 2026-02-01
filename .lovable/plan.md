
# Plan: Fix Duplicate Verification Emails and Hook Timeout Error

## Problem Summary

The registration flow has two issues:
1. **Duplicate verification emails** - Users receive two emails: one from Lovable's email-hook and one from our custom `send-verification-email` edge function
2. **Hook timeout error** - Sometimes the Lovable email-hook takes longer than 5 seconds, causing the error "Failed to reach hook within maximum time of 5.000000 seconds"

## Root Cause Analysis

When `auto_confirm_email` is **disabled**, Supabase Auth fires a `user_confirmation_requested` event on signup. This event triggers:

1. **Lovable's email-hook** (`https://api.lovable.dev/.../email-hook`) - sends the default verification email
2. **Our frontend code** (line 338 in Auth.tsx) - calls `send-verification-email` edge function - sends our custom email

The email-hook has a 5-second timeout limit. When it exceeds this, registration fails with the error shown in the screenshot.

## Solution

**Re-enable auto-confirm** and use our custom verification flow exclusively:

1. **Enable auto-confirm email** - This prevents Supabase from triggering the email-hook for confirmation requests
2. **Keep our custom verification flow** - The frontend already calls `send-verification-email` after successful signup
3. **Block login until verified** - Our `verify-email` edge function sets `email_confirm: true` via Admin API

This way:
- Only ONE email is sent (our custom email via Resend)
- No hook timeout errors (the email-hook won't be triggered for confirmations)
- Users still must verify before logging in (controlled by our verification tokens)

## Implementation Steps

### Step 1: Enable Auto-Confirm Email

Use the auth configuration tool to re-enable auto-confirm. This sounds counterintuitive, but it prevents Supabase from sending its own verification emails.

### Step 2: Add Application-Level Email Verification Check

Since Supabase will now auto-confirm emails at signup, we need to enforce verification at the application level. This requires:

1. **Add a new column to profiles table**: `email_verified` (boolean, default false)
2. **Update registration flow**: When user signs up, `email_verified` defaults to false
3. **Update verify-email function**: When token is validated, set `email_verified = true` in profiles
4. **Block access for unverified users**: Check `email_verified` in the frontend/auth context

### Step 3: Update Auth Flow

Modify the login logic to check if the user's email is verified in our application (profiles table), not just Supabase's email_confirmed_at.

## Technical Details

### Database Migration

```sql
-- Add email_verified column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Set existing confirmed users as verified
UPDATE profiles 
SET email_verified = true 
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
);
```

### Files to Modify

1. **Database**: Add `email_verified` column to profiles
2. **`supabase/functions/verify-email/index.ts`**: Update to set `email_verified = true` in profiles table
3. **`src/lib/auth.tsx`**: Add `emailVerified` to profile type and auth context
4. **`src/pages/Auth.tsx`**: Check `emailVerified` on login and show appropriate message

### Verification Flow After Changes

```text
1. User signs up
2. Supabase auto-confirms (no email-hook triggered)
3. Our code calls send-verification-email (single email sent)
4. User clicks link → verify-email sets email_verified = true
5. User can now log in
```

## Benefits

- Single verification email (no duplicates)
- No hook timeout errors
- Complete control over verification flow
- Existing functionality preserved

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Existing users affected | Migration sets `email_verified = true` for already confirmed users |
| Auth context complexity | Simple boolean check, similar to existing `isApproved` pattern |

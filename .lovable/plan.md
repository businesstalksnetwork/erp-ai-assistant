
# Plan: Enforce Email Verification Before Login

## Problem Analysis

Currently, users can log in immediately after registration without confirming their email address. This happens because:

1. **Supabase Auth has "Auto-confirm" enabled** - users are automatically confirmed at signup
2. **Evidence from database**: Most users have `email_confirmed_at` set within milliseconds of `created_at`
3. The custom verification email is sent, but it's effectively optional since users can already login

## Solution

### Step 1: Disable Auto-Confirm in Lovable Cloud Dashboard (Manual Action Required)

This is a **platform-level setting** that cannot be changed via code. You need to:

1. Open the **Lovable Cloud Dashboard** (button provided below)
2. Navigate to **Users & Authentication** settings
3. Find the **"Confirm email"** or **"Auto-confirm email"** toggle
4. **Disable auto-confirm** to require email verification

Once disabled, new users will have `email_confirmed_at = null` until they click the verification link.

### Step 2: Verify Login Error Handling (Already Implemented)

The current `handleSignIn` function already handles the "Email not confirmed" error:

```typescript
// Lines 200-202 in Auth.tsx
} else if (error.message.includes('Email not confirmed')) {
  errorMessage = 'Molimo vas da prvo potvrdite vašu email adresu. Proverite inbox za link za potvrdu.';
}
```

This will automatically work once auto-confirm is disabled.

### Step 3: Verification Flow (Already Implemented)

The complete verification flow is already in place:

- **Registration** → Sends custom verification email via `send-verification-email` Edge Function
- **Email Link** → Leads to `/verify?token=...` page
- **Verification** → `verify-email` Edge Function confirms the user via Admin API
- **Login** → User can now log in successfully

## What Changes

| Before | After |
|--------|-------|
| Users auto-confirmed at signup | Users must click verification link |
| Login works immediately | Login blocked until email verified |
| Verification email is optional | Verification email is required |

## Technical Notes

- The `verify-email` Edge Function correctly uses `supabaseAdmin.auth.admin.updateUserById` with `email_confirm: true`
- Verification tokens have proper expiry (24 hours) and single-use protection
- Error messages are already translated to Serbian

## Action Required

Open the Lovable Cloud Dashboard and disable the "Auto-confirm email" setting:

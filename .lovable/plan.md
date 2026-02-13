

# In-Store POS Flow: Store Role + Seller PIN Authentication

## Overview

This plan adds a dedicated "store" role for in-person shop locations and a PIN-based seller identification system on the POS terminal. Store users see only CRM, Sales (Prodaja), Returns (Povrati), Inventory (Magacin), and POS. Each seller sets a personal 4-digit PIN in their profile, and must enter it before using the POS terminal.

---

## Current State

- **Roles**: The `app_role` enum has: `super_admin, admin, manager, accountant, sales, hr, user`. No "store" role exists.
- **POS Terminal**: Currently auto-detects salesperson via `salespeople.user_id` match. No PIN gate.
- **salespeople table**: Has `code` (text) column already -- we will repurpose/use a new `pos_pin` column for the 4-digit PIN (keeping `code` as a display identifier).
- **Profile page**: Has display name, password change, notification preferences. No PIN field.

---

## Changes

### 1. Database Migration

Add `store` to the `app_role` enum and add `pos_pin` column to `salespeople`:

```text
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'store';

ALTER TABLE salespeople ADD COLUMN pos_pin text;
-- pos_pin stores a hashed 4-digit PIN for POS authentication
```

### 2. Role Permissions (`src/config/rolePermissions.ts`)

- Add `"store"` to the `TenantRole` union type
- Add store role permissions: `["dashboard", "crm", "sales", "inventory", "pos", "returns"]`

### 3. POS PIN in Profile Page (`src/pages/tenant/Profile.tsx`)

Add a new card section "POS PIN Code" that:
- Queries `salespeople` for the current user's record (via `user_id`)
- Shows a 4-digit PIN input field (using the existing InputOTP component for a nice UI)
- Saves the PIN (hashed with a simple approach) to `salespeople.pos_pin`
- Only visible if the user has a linked salesperson record

### 4. PIN Entry Dialog on POS Terminal (`src/pages/tenant/PosTerminal.tsx`)

Add a PIN gate before the terminal is usable:
- After an active session is found, show a PIN entry dialog instead of the terminal
- Seller enters their 4-digit PIN
- System queries `salespeople` for the session's location, matches the PIN
- On success: identify the seller and attach `salesperson_id` to all transactions
- On failure: show error, allow retry
- A "Switch Seller" button in the session info bar allows changing sellers mid-session

### 5. New Component: `src/components/pos/PosPinDialog.tsx`

A reusable dialog component with:
- 4-digit OTP input using existing `InputOTP` component
- List of sellers at the current location for display
- PIN validation against `salespeople.pos_pin`
- Returns the identified salesperson on success

### 6. Sidebar Visibility (already handled)

The existing `TenantLayout.tsx` already uses `canAccess()` checks for every sidebar group. Adding the store role to `rolePermissions` automatically hides non-permitted modules.

### 7. i18n Translations

Add new keys: `posPin`, `enterPosPin`, `setPosPin`, `pinSaved`, `invalidPin`, `switchSeller`, `identifySeller`, `store` (role name)

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `supabase/migrations/[timestamp].sql` | Add `store` to enum, add `pos_pin` column |
| `src/components/pos/PosPinDialog.tsx` | PIN entry dialog component |

### Files to Modify
| File | Change |
|------|--------|
| `src/config/rolePermissions.ts` | Add `"store"` role with CRM, sales, inventory, pos, returns access |
| `src/pages/tenant/Profile.tsx` | Add POS PIN card section |
| `src/pages/tenant/PosTerminal.tsx` | Add PIN gate before terminal access, track active seller |
| `src/integrations/supabase/types.ts` | Add `pos_pin` to salespeople type |
| `src/i18n/translations.ts` | Add new translation keys |

### Flow

```text
Store user logs in
  --> Sees only: Dashboard, CRM, Prodaja, Povrati, Magacin, POS
  --> Opens POS Terminal
  --> Active session found
  --> PIN Entry Dialog appears
  --> Seller enters 4-digit PIN
  --> System matches PIN against salespeople at that location
  --> Seller identified --> Terminal unlocked
  --> All transactions tagged with that seller's salesperson_id
  --> "Switch Seller" button to change seller without closing session
```

### PIN Storage

The PIN is stored on the `salespeople` table (not `profiles`) because:
- It is a per-salesperson credential, not per-user
- Multiple salespeople can share a single store login
- The PIN identifies which salesperson is operating the register

### Security Considerations

- PINs are short (4 digits) and intended for in-store use only, not as a login credential
- The store account itself is authenticated via normal email/password login
- PINs provide seller identification, not authentication (the store is already authenticated)
- RLS ensures PINs are only readable within the tenant




## Redesign Registration and Reset Password Pages + Fix Broken Navigation Links

### Part 1: Redesign Register Page (`src/pages/Register.tsx`)

Match the Login page's brand panel design:
- Replace the old `bg-gradient-to-br from-primary via-primary/80 to-purple-900` gradient with the dark navy palette: `from-[hsl(225,50%,12%)] via-[hsl(225,55%,18%)] to-[hsl(230,45%,10%)]`
- Add animated glowing orbs and grid pattern overlay (same as Login page)
- Replace Sparkles icon + "ERP-AI" text with the actual `erpAiLogo` image
- Add feature highlights or a registration-specific message in the brand panel
- Update mobile header to use the erpAI logo instead of Sparkles icon

### Part 2: Redesign Reset Password Page (`src/pages/ResetPassword.tsx`)

Same treatment:
- Replace old gradient with dark navy palette
- Add animated orbs and grid pattern
- Replace Sparkles icon with erpAI logo
- Update mobile header to use erpAI logo

### Part 3: Fix Broken Navigation Links in Settings Hub (`src/pages/tenant/Settings.tsx`)

Three links in the Settings page point to non-existent routes:

| Broken Link | Correct Route |
|---|---|
| `/web/settings` | `/sales/web-settings` |
| `/settings/approval-workflows` | `/settings/approvals` |
| `/settings/event-monitor` | `/settings/events` |

### Technical Details

**Files to modify:**

1. **`src/pages/Register.tsx`**
   - Import `erpAiLogo` from `@/assets/erpAI.png`
   - Remove `Sparkles` import (add feature icons like Login has)
   - Replace brand panel gradient and content with Login-style dark navy design, orbs, grid pattern, and logo
   - Update mobile header to use logo image

2. **`src/pages/ResetPassword.tsx`**
   - Import `erpAiLogo` from `@/assets/erpAI.png`
   - Remove `Sparkles` import
   - Replace brand panel with same dark navy design, orbs, grid, and logo
   - Update mobile header to use logo image

3. **`src/pages/tenant/Settings.tsx`** (3 line fixes)
   - Line 42: Change `/web/settings` to `/sales/web-settings`
   - Line 50: Change `/settings/approval-workflows` to `/settings/approvals`
   - Line 54: Change `/settings/event-monitor` to `/settings/events`


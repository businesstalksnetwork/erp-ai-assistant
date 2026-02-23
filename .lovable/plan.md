
# CRM Phase 2: Remaining Features Implementation

## Overview
Four feature blocks to implement: Expiring Quotes UI, Discount Approval UI, Discount Rules Settings, and Discount Approval Integration.

---

## 1. Expiring Quotes UI

### Quotes List (already partially done)
The `isExpiringSoon` helper and amber `AlertTriangle` icon already exist in `Quotes.tsx`. No changes needed there.

### CRM Dashboard -- "Expiring Quotes" Widget
- Add a new query in `CrmDashboard.tsx` fetching quotes with `status = 'sent'` and `valid_until` within the next 3 days
- Render a new `Card` widget titled "Expiring Quotes" with an amber `AlertTriangle` icon, showing each quote's number, partner name, valid_until date, and total
- Clicking a row navigates to `/crm/quotes`
- Place it between the "Accounts at Risk" and "CRM Tasks" sections

---

## 2. Discount Approval UI

### DiscountApprovalBadge Component
- New file: `src/components/quotes/DiscountApprovalBadge.tsx`
- Accepts `quoteId`, `tenantId`, `maxDiscountPct` props
- Queries `approval_requests` for `entity_type = 'quote_discount'` and `entity_id = quoteId`
- Displays a Badge: "Pending Approval" (amber), "Approved" (green), or "Discount Exceeds Limit" (red) depending on state
- Used in the Quotes list table (status column area) and quote form dialog

### Quote Form Warning
- In `Quotes.tsx` dialog, after the form fields, add logic:
  - Fetch the user's role-based `discount_approval_rules` for the current tenant
  - If the quote's `max_discount_pct` exceeds the rule's threshold, show an amber warning: "Discount exceeds your limit (X%). Approval required."
- The "Send" status option is blocked (disabled with tooltip) if:
  - `max_discount_pct` > the user's allowed threshold AND
  - No `approved` approval_request exists for `entity_type = 'quote_discount'`, `entity_id = quote.id`

### Blocking "Send" Logic
- When user tries to set status to `sent` and discount exceeds threshold:
  - If no approval request exists, auto-create one via `useApprovalCheck` with `entity_type = 'quote_discount'`
  - Show toast: "Approval required before sending"
  - Prevent the save mutation from executing with status = 'sent'

---

## 3. Discount Rules Settings

### New Page: `src/pages/tenant/DiscountApprovalRules.tsx`
- CRUD page for the existing `discount_approval_rules` table (role, max_discount_pct, requires_approval_above)
- Standard table + dialog pattern matching `ApprovalWorkflows.tsx` style
- Fields: Role (select from available roles), Max Discount % (number input), Requires Approval Above % (optional number input)

### Route
- Add route in `App.tsx`: `settings/discount-rules` with `ProtectedRoute requiredModule="settings-approvals"`

### Settings Page Link
- Add a new link in the Operations section of `Settings.tsx`: "Discount Rules" with `Percent` icon, linking to `/settings/discount-rules`

### Translations
- Add keys for both EN and SR: `discountRules`, `maxDiscountPct`, `requiresApprovalAbove`, `discountRuleSaved`, `discountRuleDeleted`

---

## 4. Discount Approval Integration

### Hook: `useDiscountApproval`
- New file: `src/hooks/useDiscountApproval.ts`
- Accepts `tenantId`, `quoteId`, `discountPct`
- Fetches the current user's role, then checks `discount_approval_rules` for that tenant+role
- Returns: `{ needsApproval: boolean, maxAllowed: number, approvalStatus: 'none' | 'pending' | 'approved' | 'rejected', submitForApproval: () => Promise<void> }`
- `submitForApproval` creates an `approval_request` with `entity_type = 'quote_discount'` and fires `process-module-event` + `create-notification`

### Integration Points
- `Quotes.tsx` uses `useDiscountApproval` to gate the "Send" action
- `DiscountApprovalBadge` uses `useDiscountApproval` for display state

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/quotes/DiscountApprovalBadge.tsx` | Badge showing discount approval status |
| `src/pages/tenant/DiscountApprovalRules.tsx` | Settings CRUD for discount rules |
| `src/hooks/useDiscountApproval.ts` | Hook for discount approval logic |

## Files to Modify
| File | Changes |
|------|---------|
| `src/pages/tenant/CrmDashboard.tsx` | Add "Expiring Quotes" widget |
| `src/pages/tenant/Quotes.tsx` | Integrate discount approval badge, block Send, show warnings |
| `src/pages/tenant/Settings.tsx` | Add "Discount Rules" link in Operations section |
| `src/App.tsx` | Add route for DiscountApprovalRules |
| `src/i18n/translations.ts` | Add ~10 new translation keys (EN + SR) |

## No Database Changes Needed
The `discount_approval_rules` table and `approval_requests` table already exist with all required columns. The `quotes` table already has `max_discount_pct`. No migrations required.

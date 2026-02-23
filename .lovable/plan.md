

# CRM Phase 2: Partially Won, Quote Versioning & Approvals

Three features implemented sequentially, building on the existing CRM pipeline and quoting system.

---

## Feature 1: Partially Won Stage with Split Logic

### Problem
Currently, deals can only be fully won or fully lost. In practice, deals are often partially won -- a customer accepts some items but rejects others.

### Database Changes

**New columns on `opportunities`:**
- `won_amount` NUMERIC DEFAULT 0
- `lost_amount` NUMERIC DEFAULT 0
- `won_reason` TEXT
- `lost_reason` TEXT
- `followup_opportunity_id` UUID (self-reference for auto-created follow-up)

**New column on `opportunity_stages`:**
- `is_partial` BOOLEAN DEFAULT FALSE -- marks the "Partially Won" stage

**Seed a new stage** for each tenant that already has stages:
- Code: `partial_won`, Name: "Partially Won" / "Delimicno dobijeno", color: `#f59e0b`, `is_partial = true`, placed before Won/Lost in sort order

### UI Changes

**OpportunityDetail.tsx -- Split Dialog:**
When a user clicks the "Partially Won" stage button, show a dialog:
- Won amount (number input, max = deal value)
- Lost amount (auto-calculated as value - won_amount)
- Won reason (text)
- Lost reason (text)
- Checkbox: "Create follow-up opportunity for lost portion"
- On submit: update opportunity with split amounts, optionally create a new opportunity with `value = lost_amount`

**OpportunityOverviewTab.tsx:**
- Show won/lost amounts when stage is `partial_won`
- Show link to follow-up opportunity if one exists

**Kanban (Opportunities.tsx):**
- Show split amounts on cards in the partial_won column

### Win Rate Metrics (CRM Dashboard)
Add three metrics:
- Full win rate: `won / (won + lost + partial)`
- Partial win rate: `(won + partial) / total closed`
- Revenue win rate: `sum(won_amount) / sum(value) for closed deals`

---

## Feature 2: Quote Versioning (Immutable Snapshots)

### Problem
When a quote is revised after being sent, there's no history of previous versions. Customers and sales teams need to compare versions.

### Database Changes

**New table: `quote_versions`**
- `id` UUID PK
- `tenant_id` UUID NOT NULL
- `quote_id` UUID REFERENCES quotes ON DELETE CASCADE
- `version_number` INT NOT NULL
- `snapshot` JSONB NOT NULL -- full quote + lines snapshot
- `created_by` UUID
- `created_at` TIMESTAMPTZ DEFAULT now()
- `notes` TEXT -- what changed
- RLS: tenant member access

**New columns on `quotes`:**
- `current_version` INT DEFAULT 1
- `max_discount_pct` NUMERIC DEFAULT 0 -- highest discount % on any line

### Logic

**Auto-snapshot on status change to 'sent':**
- When a quote transitions to `sent`, automatically create a `quote_versions` record capturing the current state (quote fields + all quote_lines as JSONB)
- Increment `current_version`

**Manual "Create New Version" button:**
- Resets status to `draft`, increments version, snapshots current state
- Available when quote is in `sent` or `expired` status

### UI Changes

**Quotes.tsx:**
- Show version badge (v1, v2, v3) next to quote number

**New QuoteVersionHistory component:**
- Side panel or dialog showing all versions
- Click a version to see the snapshot (read-only rendered table)
- Diff indicator showing what changed between versions

---

## Feature 3: Quote Expiry Automation & Discount Approvals

### Quote Expiry

**Database function: `expire_overdue_quotes`**
- Finds quotes where `valid_until < CURRENT_DATE` AND `status = 'sent'`
- Updates status to `expired`
- Creates a CRM task (type: `quote_expired`) for follow-up

**Edge function or cron trigger:**
- Add to `crm-tier-refresh` edge function as an additional step, or create a dedicated `crm-quote-maintenance` function

**UI: 3-day warning**
- On quotes list, show amber warning icon for quotes expiring within 3 days
- On CRM Dashboard, add "Expiring Quotes" widget

### Discount Approval Matrix

**New table: `discount_approval_rules`**
- `id` UUID PK
- `tenant_id` UUID NOT NULL
- `role` TEXT NOT NULL (e.g., 'sales_rep', 'sales_manager', 'admin')
- `max_discount_pct` NUMERIC NOT NULL (e.g., 10, 25, 100)
- `requires_approval_above` NUMERIC -- threshold above which approval is needed
- `created_at` TIMESTAMPTZ

**Logic in Quote save/send:**
- When saving a quote, calculate the max discount % across all lines
- Compare against the user's role-based limit from `discount_approval_rules`
- If discount exceeds limit: create an approval request (using existing `approval_workflows` system)
- Block status change to `sent` until approved

**UI:**
- Settings page section for discount rules
- On quote form: show warning when discount exceeds threshold
- Badge on quote indicating "Pending Approval" when discount requires sign-off

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | New columns, tables, functions, seed data |
| `src/pages/tenant/OpportunityDetail.tsx` | Modify | Add split dialog for partial won |
| `src/components/opportunity/OpportunityOverviewTab.tsx` | Modify | Show split amounts |
| `src/components/opportunity/PartialWonDialog.tsx` | Create | Split amount dialog component |
| `src/pages/tenant/Opportunities.tsx` | Modify | Show split amounts on Kanban cards |
| `src/pages/tenant/CrmDashboard.tsx` | Modify | Add win rate metrics, expiring quotes widget |
| `src/pages/tenant/Quotes.tsx` | Modify | Version badge, expiry warnings, discount indicators |
| `src/components/quotes/QuoteVersionHistory.tsx` | Create | Version history viewer |
| `src/components/quotes/DiscountApprovalBadge.tsx` | Create | Discount status indicator |
| `src/pages/tenant/Settings.tsx` | Modify | Add discount approval rules section |
| `src/i18n/translations.ts` | Modify | New translation keys |
| `supabase/functions/crm-tier-refresh/index.ts` | Modify | Add quote expiry step |

---

## Implementation Order

1. **Migration** -- all schema changes in one migration (new columns, tables, seed partial_won stage, functions)
2. **Feature 1 UI** -- PartialWonDialog, OpportunityDetail changes, Kanban updates, dashboard metrics
3. **Feature 2 UI** -- Quote versioning logic, QuoteVersionHistory component, version badges
4. **Feature 3 UI** -- Expiry warnings, discount approval rules, approval integration

---

## Technical Notes

- The `snapshot` JSONB in `quote_versions` stores: `{ quote: {...}, lines: [...] }` -- a complete point-in-time copy
- Discount approval reuses the existing `approval_workflows` + `approval_requests` tables with `entity_type = 'quote_discount'`
- The partial_won stage uses `is_partial` flag on `opportunity_stages` (not hardcoded stage code) so tenants can rename it
- Follow-up opportunities reference the parent via `followup_opportunity_id` for traceability
- Quote expiry function is idempotent and safe to run multiple times


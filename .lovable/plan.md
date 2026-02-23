
# Enhance Meetings with Partner Links, Attendees, Opportunity Connection, and Fast-Add

## Current State
- **`meetings`** table exists with basic fields (title, scheduled_at, duration, location, channel, status, notes) but NO link to partners or opportunities
- **`meeting_participants`** table exists with `contact_id`, `employee_id`, `company_id` (FK to old `companies` table), `is_organizer`, `is_internal` -- but company_id still points to `companies`, not `partners`
- **`meeting_types`** table exists (name, name_sr, color)
- The `Meetings.tsx` page is a basic CRUD with no partner association, no attendees, no opportunity link
- `CompanyDetail.tsx` (partner detail) has no meetings tab
- `OpportunityDetail.tsx` has no meetings section
- 0 meetings in the database currently

## What We're Building (Adapted from ProBusinessManagement)

### 1. Database Migration
- Add `partner_id` (FK to partners) and `opportunity_id` (FK to opportunities) columns to `meetings`
- Add `outcome` (text) and `next_steps` (text) columns to `meetings` for meeting log functionality
- Add `external_name` (text) column to `meeting_participants` for external attendees (non-contact people)
- Add `partner_id` (FK to partners) column to `meeting_participants`, drop the `company_id` FK to companies (since we unified to partners)
- Add `created_by` (uuid) to `meetings` to track who created the meeting
- RLS policies already exist and are correct (tenant-based)

### 2. Rewrite `Meetings.tsx` -- Full Meeting Management
- **Partner multi-select**: A meeting can involve multiple partners (via `meeting_participants` with `partner_id`), but also has a primary `partner_id` on the meeting itself
- **Opportunity link**: Optional dropdown to link a meeting to an opportunity (prilika). The opportunity dropdown filters by tenant and shows opportunity title + partner name
- **Attendee picker** (adapted from ProBusinessManagement):
  - Checkbox list of contacts from the selected partner(s), grouped by partner name
  - "External attendee" free-text input to add names of people not in the system
  - Selected attendees shown as badges with remove buttons
- **Outcome & Next Steps** fields in the form
- **Communication channel** and **Meeting type** selectors (using `meeting_types` table)
- Stats cards remain (Today, Upcoming, Completed)

### 3. Fast-Add Meeting from Partner Detail (`CompanyDetail.tsx`)
- Add a **"Meetings" tab** to the partner detail page showing all meetings linked to that partner (via `meeting_participants.partner_id` or `meetings.partner_id`)
- Add a **"Log Meeting" button** that opens a pre-filled meeting dialog with the current partner already selected
- Meeting list shows: title, date, attendees as badges, outcome, next steps
- Meetings sorted by date descending

### 4. Fast-Add Meeting from Opportunity Detail (`OpportunityDetail.tsx`)
- Add a **"Meetings" section** showing meetings linked to that opportunity via `meetings.opportunity_id`
- Add a **"Log Meeting" button** that opens meeting dialog pre-filled with the opportunity and its partner
- Since an opportunity already has a `partner_id`, the meeting form auto-selects that partner and pre-loads its contacts

### 5. Opportunity Multi-Partner Support
- The `opportunities` table currently has a single `partner_id`. To support "prilike can be between more than one partner", we create an `opportunity_partners` junction table (opportunity_id, partner_id, tenant_id, role text)
- Update `Opportunities.tsx` form to allow selecting multiple partners
- Update `OpportunityDetail.tsx` to show all linked partners

## Technical Details

### New Migration SQL
```text
-- Add columns to meetings
ALTER TABLE meetings ADD COLUMN partner_id uuid REFERENCES partners(id);
ALTER TABLE meetings ADD COLUMN opportunity_id uuid REFERENCES opportunities(id);
ALTER TABLE meetings ADD COLUMN outcome text;
ALTER TABLE meetings ADD COLUMN next_steps text;
ALTER TABLE meetings ADD COLUMN created_by uuid;

-- Fix meeting_participants: add partner_id, external_name; drop company_id FK
ALTER TABLE meeting_participants ADD COLUMN partner_id uuid REFERENCES partners(id);
ALTER TABLE meeting_participants ADD COLUMN external_name text;
ALTER TABLE meeting_participants DROP CONSTRAINT meeting_participants_company_id_fkey;

-- Opportunity multi-partner junction
CREATE TABLE opportunity_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text DEFAULT 'participant',
  created_at timestamptz DEFAULT now(),
  UNIQUE(opportunity_id, partner_id)
);
ALTER TABLE opportunity_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON opportunity_partners FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
```

### Files to Create/Modify
1. **New migration** -- schema changes above
2. **`src/pages/tenant/Meetings.tsx`** -- Full rewrite with partner/opportunity selectors, attendee picker, outcome/next_steps
3. **`src/pages/tenant/CompanyDetail.tsx`** -- Add Meetings tab with fast-add button
4. **`src/pages/tenant/OpportunityDetail.tsx`** -- Add meetings section with fast-add
5. **`src/pages/tenant/Opportunities.tsx`** -- Multi-partner selector in form
6. **`src/i18n/translations.ts`** -- New keys for outcome, nextSteps, attendees, logMeeting, externalAttendee, etc.

### What We Skip (per user request)
- No web meeting integrations (Zoom, Teams, Google Meet)
- No Fireflies or transcription
- No project linking from ProBusinessManagement (that's a PM concept)

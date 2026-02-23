
# Refactor Meetings: Schedule vs Log, Multi-Partner, Internal Staff, Calendar

## What's Wrong Now

1. **Single dialog for everything** -- "Dodaj sastanak" mixes scheduling (future) with logging (past). Outcome and next steps should NOT appear when scheduling; they belong on a "log meeting" (record what happened).
2. **Single partner only** -- The dialog has one partner dropdown. Meetings often involve multiple partners.
3. **No internal staff** -- Cannot add your own employees as attendees, only external contacts from a partner.
4. **External attendees by name only** -- Should be by email (for future invite sending).
5. **No calendar view** -- Meetings need a monthly calendar like WorkLogsCalendar.
6. **No fast-add "Log Meeting"** -- No way to quickly record a meeting that already happened with outcome/next steps.

## Solution

### 1. Two Distinct Actions on the Meetings Page

**"Zakazi sastanak" (Schedule Meeting)** button:
- Opens a dialog WITHOUT outcome/next_steps fields
- Status defaults to "scheduled"
- Fields: Title, Date, Duration, Channel, Location, Description, Notes
- Multi-partner selector (checkboxes from partner list)
- For each selected partner: show their contacts as checkboxes
- Internal staff section: checkboxes from `employees` table (your own team)
- External attendees: input with email field (not just name)
- On save, sets `status = 'scheduled'`

**"Evidentiraj sastanak" (Log Meeting)** button:
- Opens a dialog WITH outcome and next_steps fields
- Status defaults to "completed"
- Same attendee picker (multi-partner, internal staff, external)
- Additional fields: Outcome (textarea), Next Steps (textarea)
- On save, sets `status = 'completed'`

Both share the same underlying form component but conditionally show/hide fields.

### 2. Multi-Partner Support on Meetings

Currently `meetings.partner_id` is a single FK. We will:
- Keep `meetings.partner_id` as the "primary" partner (nullable, backward compatible)
- Use `meeting_participants` with `partner_id` to track all partner associations
- In the dialog: show a checkbox list of partners; when partners are checked, their contacts appear grouped by partner name
- The table view shows all linked partner names (comma-separated)

### 3. Internal Staff (Employees) as Attendees

- Add a section "Interni ucesnici" with checkboxes from `employees` table (active, same tenant)
- Store in `meeting_participants` with `employee_id` + `is_internal = true`
- Show as badges with a different color than external contacts

### 4. External Attendees with Email

- Change the external attendee input from just "name" to "name + email" fields
- Store `external_name` and add `external_email` column to `meeting_participants`
- DB migration: `ALTER TABLE meeting_participants ADD COLUMN external_email text`

### 5. Meetings Calendar Page

- New page: `src/pages/tenant/MeetingsCalendar.tsx`
- Monthly grid view (same pattern as WorkLogsCalendar)
- Each day cell shows meeting titles with channel icon and status color
- Click on a day cell to see that day's meetings
- Navigation: month forward/back, filter by status
- Route: `/crm/meetings/calendar`
- Button on Meetings page to switch to calendar view

### 6. Updated Meeting Table

- "Partner" column shows all linked partners (not just primary)
- Add "Ucesnici" column showing attendee count or badges

## Database Migration

```text
ALTER TABLE meeting_participants ADD COLUMN external_email text;
```

No other schema changes needed -- `meeting_participants` already has `employee_id`, `partner_id`, `contact_id`, `external_name`, `is_internal`.

## Files to Create/Modify

1. **New migration** -- Add `external_email` to `meeting_participants`
2. **`src/pages/tenant/Meetings.tsx`** -- Major rewrite:
   - Two buttons: "Zakazi sastanak" + "Evidentiraj sastanak"
   - Shared dialog with `mode` prop ('schedule' | 'log')
   - Multi-partner checkbox selector
   - Grouped contacts per selected partner
   - Internal employees section
   - External attendees with name + email
   - Conditionally show outcome/next_steps only in 'log' mode
   - Button to navigate to calendar view
3. **`src/pages/tenant/MeetingsCalendar.tsx`** -- New calendar view
4. **`src/App.tsx`** -- Add route for `/crm/meetings/calendar`
5. **`src/i18n/translations.ts`** -- New keys: scheduleMeeting, logMeeting, internalAttendees, externalEmail, meetingsCalendar, evidentirajSastanak
6. **`src/layouts/TenantLayout.tsx`** -- Optionally add calendar sub-link under meetings

## What We Skip

- Actual email sending for meeting invites (noted as future feature -- Lovable email is auth-only)
- The plan mentions "automatski ce se slati pozivi" -- we will add a visual indicator "Pozivnica ce biti poslata na: email@..." but actual sending requires a third-party email service which we flag as a future integration

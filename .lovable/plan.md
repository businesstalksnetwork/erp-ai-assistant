
# Redesign Meeting Forms: Full-Screen Layout with Two-Column Cards

## What Changes

Replace the current cramped `Dialog` (max-w-2xl) with a **full-screen overlay page** layout, inspired by the uploaded screenshot from the reference project. Instead of a scrollable dialog, both "Zakazi sastanak" and "Evidentiraj sastanak" will open as a near-full-screen panel with a clean two-column card layout.

## New Layout (Matching Reference Screenshot)

The form opens as a full-screen overlay (or a dedicated route-like panel) with:

```text
+----------------------------------------------------------+
| <- Back    Novi Sastanak / Evidentiraj Sastanak           |
|            Zakazite novi / Evidentirajte odrzani          |
+----------------------------------------------------------+
|                                                          |
|  +-- Osnovni Podaci --------+  +-- Ucesnici -----------+|
|  | Naslov *                  |  | Zaposleni (Interni)   ||
|  | Tip Sastanka              |  |   [ ] Employee 1      ||
|  | Datum i Vreme * | Trajanje|  |   [ ] Employee 2      ||
|  | Kanal Komunikacije        |  |                       ||
|  | Lokacija                  |  | Kontakti (Eksterni)   ||
|  | Napomene (agenda)         |  |   grouped by partner  ||
|  |                           |  |                       ||
|  | (Log mode only:)          |  | Eksterni ucesnici     ||
|  | Ishod                     |  |   Name + Email + Add  ||
|  | Sledeci koraci            |  |                       ||
|  +---------------------------+  | [badges of selected]  ||
|                                 +------------------------+|
|  +-- Kompanije -------------+  +-- Prilika -------------+|
|  | [ ] Partner 1             |  | Select opportunity     ||
|  | [ ] Partner 2             |  |                        ||
|  +---------------------------+  +------------------------+|
|                                                          |
|  [Otkazi]  [Zakazi Sastanak / Evidentiraj]               |
+----------------------------------------------------------+
```

## Implementation Details

### Replace Dialog with Full-Screen Overlay

- Instead of `<Dialog>`, use a **Sheet from the right** with `side="right"` and full width, OR better: a **conditional render** that replaces the table view with the form view (same pattern as the reference screenshot -- back arrow returns to list).
- The form view uses `grid grid-cols-1 lg:grid-cols-2 gap-6` for the two-column card layout.
- Each section is wrapped in a `Card` with `CardHeader` (icon + title + subtitle) and `CardContent`.

### Four Cards

1. **Osnovni Podaci** (Basic Info) -- Left column, top
   - Title, Meeting Type (from `meeting_types`), Date+Time, Duration, Channel, Location, Notes/Agenda
   - In "log" mode: adds Outcome and Next Steps textareas at the bottom of this card

2. **Ucesnici** (Attendees) -- Right column, top
   - Internal employees section with checkboxes
   - External contacts grouped by selected partner(s) with checkboxes
   - External attendees free-text (name + email) with add button
   - Selected attendees shown as badges with remove
   - Invite preview (schedule mode only)

3. **Kompanije** (Partners) -- Left column, bottom
   - Multi-select checkbox list of partners
   - Subtitle: "Povezane kompanije (opciono)"

4. **Prilika** (Opportunity) -- Right column, bottom
   - Optional dropdown to link to an opportunity
   - Subtitle: "Povezite sa prilikom (opciono)"

### Footer

- Sticky bottom bar with Cancel (left) and Submit button (right)
- Submit text changes: "Zakazi Sastanak" in schedule mode, "Evidentiraj" in log mode

### Navigation

- When form is open, the meetings table is hidden and the form is shown in its place
- Back arrow at top-left returns to the list view
- No route change needed -- just component state (`showForm` boolean)

## Files to Modify

1. **`src/pages/tenant/Meetings.tsx`** -- Major UI refactor:
   - Add `showForm` state to toggle between list view and form view
   - Form view renders 4 Cards in a 2-column grid
   - All existing logic (queries, mutations, attendee management) stays the same
   - Dialog removed, replaced with inline form view
   - Add meeting type selector (query `meeting_types` table)
   - Conditionally show outcome/next_steps only in log mode

2. **`src/i18n/translations.ts`** -- Add keys:
   - `osnovniPodaci` / "Basic Info" / "Osnovni podaci"
   - `ucesnici` / "Attendees" / "Ucesnici"
   - `povezaneKompanije` / "Linked companies (optional)" / "Povezane kompanije (opciono)"
   - `poveziteSaPrilikom` / "Link to opportunity (optional)" / "Povezite sa prilikom (opciono)"
   - `meetingType` / "Meeting Type" / "Tip sastanka"
   - `agenda` / "Agenda" / "Agenda, teme za diskusiju..."

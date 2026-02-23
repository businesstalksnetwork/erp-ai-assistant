

# Full Application Optimization: Responsive, Connected, and Polished

## Summary

A comprehensive pass across the CRM/Opportunity system and related pages to fix bugs, improve mobile responsiveness, strengthen data connections, and polish the UI end-to-end.

---

## 1. Bug Fixes

### 1.1 Fix React ref warning on OpportunityActivityTab
The console shows: "Function components cannot be given refs" for `OpportunityActivityTab`. The `TabsContent` component passes a ref to it. Wrap the component export with `React.forwardRef`.

**Files**: `OpportunityActivityTab.tsx`, `OpportunityDocumentsTab.tsx`, `OpportunityDiscussionTab.tsx`, `OpportunityOverviewTab.tsx`, `OpportunityTagsBar.tsx`

### 1.2 Kanban grid-cols-5 breaks on mobile
Currently `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` -- on tablets (sm), only 2 columns show which truncates 5 stages awkwardly. Change to a horizontal scrollable container on mobile and stacked cards.

**File**: `Opportunities.tsx`

---

## 2. Mobile Responsiveness

### 2.1 Opportunity Detail page
- Header: Stack title, badge, and tags vertically on mobile instead of wrapping horizontally
- Stage buttons: Make horizontally scrollable in a `overflow-x-auto` container instead of wrapping
- Tabs: Use `overflow-x-auto` on `TabsList` for mobile
- Overview tab: The `md:grid-cols-2` grid works well; meetings table needs `overflow-x-auto` wrapper
- Documents tab: Table needs `overflow-x-auto` or convert to card layout on mobile
- Discussion tab: Already works well with chat bubbles

### 2.2 Meetings page
- List view filters: Wrap in `MobileFilterBar` component for mobile collapse
- Meeting table: Add `overflow-x-auto` wrapper
- Form view: Two-column grid already has `grid-cols-1 lg:grid-cols-2` which is good
- Action buttons in header: Stack on mobile (currently inline, may overflow)
- Stats cards: Already `sm:grid-cols-3`

### 2.3 Kanban (Opportunities.tsx)
- Replace the fixed grid with a horizontally scrollable flex container on mobile
- Each Kanban column gets a minimum width (250px) and the container scrolls horizontally
- Add a visual scroll indicator

---

## 3. Connection Improvements

### 3.1 Opportunity Detail - Meeting link
Currently navigates to `/crm/meetings?opportunity=...` but the Meetings page does not read URL params to pre-fill the form. Add URL param parsing in Meetings.tsx to auto-open the schedule form with the opportunity pre-selected.

**File**: `Meetings.tsx`

### 3.2 Opportunity tags on Kanban cards
Tags already display on Kanban cards (working). Verify `opportunity_tags` query includes tenant_id filter (it does).

### 3.3 Activity logging completeness
Currently activity is logged for: stage changes, quote creation, follower add, document upload, comment add, tag add. Missing: tag removal activity logging.

**File**: `OpportunityTagsBar.tsx` -- add `onActivity("tag_removed", ...)` in remove mutation

### 3.4 Meetings table on Overview tab - click to navigate
Meeting rows in OpportunityOverviewTab are not clickable. Add `onClick` to navigate to meeting edit.

**File**: `OpportunityOverviewTab.tsx`

---

## 4. UI Polish

### 4.1 Consistent empty states
Some empty states use different messages/styles. Standardize to the same pattern across all opportunity tabs.

### 4.2 Discussion tab improvements
- Add a subtle timestamp separator between messages from different days
- Increase max-height on mobile for the chat scroll area

### 4.3 Stage progression visual
Replace plain buttons with a step-progress indicator showing which stages have been passed, making the pipeline progression more visual and intuitive.

### 4.4 Sticky tab bar
On the Opportunity Detail page, make the `TabsList` sticky below the header so it remains visible when scrolling long content.

---

## 5. Performance

### 5.1 Reduce unnecessary re-renders
- Memoize `fmt` function and `contactName` in OpportunityDetail using `useMemo`
- Memoize `grouped` array and `getOppTags` in Opportunities.tsx

### 5.2 Query optimization
- The `opportunity-tags-all` query fetches ALL tags for the tenant. This is fine for now but add a `staleTime` to reduce refetches.

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `OpportunityActivityTab.tsx` | Wrap with `forwardRef` |
| `OpportunityDocumentsTab.tsx` | `forwardRef`, mobile table overflow |
| `OpportunityDiscussionTab.tsx` | `forwardRef`, responsive chat height |
| `OpportunityOverviewTab.tsx` | `forwardRef`, meetings table overflow, row click |
| `OpportunityTagsBar.tsx` | Tag removal activity logging |
| `OpportunityDetail.tsx` | Sticky tabs, mobile header layout, scrollable stages, `useMemo` |
| `Opportunities.tsx` | Horizontal scroll Kanban on mobile, `useMemo` |
| `Meetings.tsx` | `MobileFilterBar`, URL param parsing for opportunity pre-fill, table overflow |
| `src/index.css` | Add utility class for horizontal scroll snap (optional) |

### No database changes required
All optimizations are frontend-only.


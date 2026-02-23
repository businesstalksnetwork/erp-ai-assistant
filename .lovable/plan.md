

## Smooth Navigation, Page Transitions & Documentation Update

### Problem Analysis

There are two distinct issues causing poor UX during navigation:

1. **Full-page refresh on route change**: The `<Suspense fallback={<LoadingFallback />}>` in `App.tsx` wraps ALL routes (line 198), including the layout components. When a lazy-loaded page is first loaded, React unmounts the entire tree (sidebar + header + content) and shows a centered spinner. This makes the sidebar and header "disappear and reappear" on every new page visit.

2. **No page transition animation**: When navigating between pages, content just pops in with no visual continuity. There is no `AnimatePresence` or transition wrapper around the page content area.

3. **WMS_AI_REPORT.md** still lists issues as unresolved that were fixed in previous sessions.

---

### Changes

#### 1. Fix Suspense Boundary (Stop sidebar/header refresh)

**File: `src/App.tsx`**

Move the `<Suspense>` wrapper from around ALL routes to only around the child routes inside each layout. The layout components (`TenantLayout`, `SuperAdminLayout`) render via `<Outlet />`, so lazy children suspend inside the layout, not above it.

- Remove the outer `<Suspense fallback={<LoadingFallback />}>` that wraps all `<Routes>`
- Keep lazy imports as-is (code splitting is good)

**File: `src/layouts/TenantLayout.tsx`**

Wrap the `<Outlet />` (line 518) in a `<Suspense>` with an inline skeleton/shimmer fallback instead of a spinner. This ensures the sidebar and header stay mounted while only the content area shows a loading state.

The fallback will be a subtle content-area skeleton (pulsing bars mimicking a page header + card grid) instead of a spinner, creating the "no loading" feel.

**File: `src/layouts/SuperAdminLayout.tsx`**

Same pattern: wrap the `<Outlet />` in `<Suspense>` with the same skeleton fallback.

#### 2. Smooth Page Transitions with Framer Motion

**File: `src/layouts/TenantLayout.tsx`**

Add an `AnimatePresence` + `motion.div` wrapper around the `<Outlet />` keyed by `location.pathname`. This produces a subtle fade+slide transition (opacity 0 to 1, translateY 8px to 0, 200ms) when navigating between pages. The sidebar and header remain completely static.

**File: `src/layouts/SuperAdminLayout.tsx`**

Same transition wrapper for consistency.

#### 3. Content Skeleton Fallback Component

**File: `src/components/shared/PageSkeleton.tsx`** (new file)

A reusable skeleton that mimics a typical page layout:
- A header bar (title placeholder + action buttons placeholder)
- A row of 4 stat cards (pulsing rectangles)
- A large content area card (table placeholder with rows)

This replaces the spinning circle, creating the impression that the page is "already there" and just filling in data.

#### 4. Update WMS_AI_REPORT.md

Mark the following issues as RESOLVED:
- "Sequential Task Generation" -- resolved via batch INSERT
- "No Scenario Comparison" -- resolved via comparison view
- "Local Algorithm Ignores Capacity" -- resolved via capacity validation
- "AI Constraint Validation" -- resolved via post-AI capacity checks

Move completed recommendations to an "Implemented" section.

#### 5. Update COMPLETE_CODEBASE_REVIEW.md

Add entry for v3.0 UX improvements:
- Suspense boundary fix (sidebar/header persistence)
- Framer Motion page transitions
- Skeleton loading states

---

### Technical Details

**Files to create (1):**
- `src/components/shared/PageSkeleton.tsx` -- reusable skeleton fallback

**Files to modify (5):**
- `src/App.tsx` -- remove outer Suspense wrapper
- `src/layouts/TenantLayout.tsx` -- add Suspense + AnimatePresence around Outlet
- `src/layouts/SuperAdminLayout.tsx` -- add Suspense + AnimatePresence around Outlet
- `WMS_AI_REPORT.md` -- mark resolved issues
- `COMPLETE_CODEBASE_REVIEW.md` -- add v3.0 UX improvements

**No new dependencies needed** -- framer-motion is already installed (v12.34.0).




## Implement High-Value Recommendations from the Review Report

### Overview

Based on the deep research report review against the current codebase, many recommendations are already implemented (unique constraints on `chart_of_accounts.code` and `invoices.invoice_number`, `NUMERIC` types for debit/credit, audit logging via `log_audit_event` trigger, fiscal period validation). The remaining high-impact, feasible improvements fall into 4 categories.

---

### 1. useDebounce Hook + Apply Across Search Inputs

**Problem**: 37+ pages perform client-side `.filter()` on search state that updates on every keystroke, causing unnecessary re-renders.

**Solution**: Create a `useDebounce` hook and apply it to the highest-traffic list pages.

**File to create**: `src/hooks/useDebounce.ts`
- Simple hook: accepts a value and delay (default 300ms), returns debounced value

**Files to modify** (apply debounced search to filtered results):
- `src/pages/tenant/Invoices.tsx` -- wrap `search` with `useDebounce` before filtering
- `src/pages/tenant/JournalEntries.tsx` -- same pattern
- `src/pages/tenant/Products.tsx` -- same pattern
- `src/pages/tenant/Partners.tsx` -- same pattern (if client-side filtering present)

Each page change is minimal: add import, add `const debouncedSearch = useDebounce(search, 300);`, replace `search` with `debouncedSearch` in the filter logic.

---

### 2. Server-Side Pagination for High-Volume Tables

**Problem**: Invoices, journal entries, and products fetch ALL rows with no pagination, hitting the Supabase 1000-row default limit and causing slow loads on large tenants.

**Solution**: Add server-side pagination using `.range()` to 3 key pages, with Previous/Next controls.

**Files to create**: `src/hooks/usePaginatedQuery.ts`
- Reusable hook encapsulating page state, PAGE_SIZE (50), and `.range()` query pattern
- Returns `{ data, page, setPage, hasMore, isLoading }`

**Files to modify**:
- `src/pages/tenant/Invoices.tsx` -- replace unbounded `select("*")` with paginated query + pagination controls at bottom
- `src/pages/tenant/JournalEntries.tsx` -- same
- `src/pages/tenant/Products.tsx` -- same

Each page adds pagination state, modifies the query to use `.range()`, and adds `PaginationPrevious`/`PaginationNext` controls from the existing `src/components/ui/pagination.tsx`.

---

### 3. Lazy Loading (Code Splitting) for App.tsx

**Problem**: App.tsx eagerly imports 100+ page components, creating a large initial bundle even for pages the user may never visit.

**Solution**: Convert page imports to `React.lazy()` with a `Suspense` fallback.

**File to modify**: `src/App.tsx`
- Replace direct imports with `React.lazy(() => import(...))` for all tenant and super-admin pages
- Wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>`
- Keep non-page imports (layouts, providers) as eager imports

This reduces the initial JS bundle significantly and improves Time to Interactive.

---

### 4. useMemo for Client-Side Filtering (Consistency Pass)

**Problem**: Many pages (37+) call `.filter()` directly in the render path without `useMemo`, causing re-computation on every render even when inputs haven't changed.

**Solution**: Wrap `filtered` computations in `useMemo` on the highest-traffic pages that don't already use it.

**Files to modify** (add `useMemo` to the `filtered` variable):
- `src/pages/tenant/Invoices.tsx`
- `src/pages/tenant/JournalEntries.tsx`
- `src/pages/tenant/Products.tsx`
- `src/pages/tenant/Partners.tsx`
- `src/pages/tenant/BankStatements.tsx`

Each change wraps the existing `const filtered = data.filter(...)` with `useMemo(() => data.filter(...), [data, search, statusFilter])`.

---

### Technical Details

**New files**:
- `src/hooks/useDebounce.ts` -- ~15 lines, useState + useEffect pattern
- `src/hooks/usePaginatedQuery.ts` -- ~40 lines, wraps page state + TanStack Query

**Modified files**:
- `src/App.tsx` -- Convert ~100 imports to `React.lazy()`
- `src/pages/tenant/Invoices.tsx` -- debounce + pagination + useMemo
- `src/pages/tenant/JournalEntries.tsx` -- debounce + pagination + useMemo
- `src/pages/tenant/Products.tsx` -- debounce + pagination + useMemo
- `src/pages/tenant/Partners.tsx` -- debounce + useMemo
- `src/pages/tenant/BankStatements.tsx` -- useMemo

**No database migrations needed** -- unique constraints and NUMERIC types are already in place. No schema changes required.


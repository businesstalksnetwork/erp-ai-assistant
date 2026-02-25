

# E2E Automation Test Suite for Entire Application

## Context

The existing e2e tests are outdated -- they reference `/auth` routes (the app uses `/login`), use Serbian text that may not match current UI, and only cover 4 files (auth, navigation, invoice-flow, responsive). The app has 150+ pages across 8 module groups. All routes are behind `ProtectedRoute` which redirects unauthenticated users to `/login`.

## Test Strategy

Since all tenant routes require authentication and we cannot provision real credentials in e2e tests, the tests will:
1. **Verify unauthenticated redirects** -- confirm every major route redirects to `/login`
2. **Verify login page renders correctly** -- the actual entry point
3. **Verify public pages** (login, register, reset-password) render without errors
4. **Verify no JS crashes** on page load for key routes (check console for uncaught errors)
5. **Fix existing broken tests** that reference `/auth` instead of `/login`

## Files to Create/Modify

### 1. Fix `e2e/auth.spec.ts` (existing -- broken)
- Change all `/auth` references to `/login`
- Update text matchers: "Prijavi se" -> match the actual login page h2 text
- Update selectors to match `Login.tsx` structure (email/password inputs with `id="email"` and `id="password"`)

### 2. Fix `e2e/responsive.spec.ts` (existing -- broken)
- Replace `/auth` with `/login` in the pages list
- Remove stale routes (`/kpo`, `/reminders`, `/invoice-analytics`) that don't exist
- Add correct routes

### 3. Fix `e2e/navigation.spec.ts` (existing -- may break on unauthenticated)
- Tests go to `/dashboard` without auth, so they'll redirect to `/login`. Update expectations accordingly.

### 4. Fix `e2e/invoice-flow.spec.ts` (existing -- same issue)
- Goes to `/invoices` without auth. Update to expect redirect.

### 5. Create `e2e/public-pages.spec.ts` (new)
Tests for unauthenticated pages:
- `/login` -- renders login form with email, password, submit button
- `/register` -- renders registration form
- `/reset-password` -- renders reset password form
- `/` -- redirects to `/login`
- Unknown route (e.g. `/nonexistent`) -- shows NotFound page

### 6. Create `e2e/route-protection.spec.ts` (new)
Bulk test that every major module route redirects unauthenticated users to `/login`. Covers all 8 module groups with representative routes:
- `/dashboard`, `/accounting`, `/accounting/chart-of-accounts`, `/accounting/journal`
- `/crm`, `/crm/partners`, `/crm/leads`, `/crm/opportunities`
- `/sales`, `/sales/quotes`, `/sales/sales-orders`
- `/inventory`, `/inventory/products`, `/inventory/stock`
- `/hr`, `/hr/employees`, `/hr/payroll`
- `/purchasing`, `/purchasing/orders`
- `/production`, `/production/orders`
- `/pos`, `/pos/terminal`
- `/analytics`, `/analytics/ratios`, `/analytics/profitability`
- `/documents`, `/drive`
- `/settings`, `/settings/users`
- `/returns`, `/profile`
- `/super-admin/dashboard`

Each test: `goto(route)` -> expect redirect to `/login`.

### 7. Create `e2e/page-no-crash.spec.ts` (new)
For each public page (`/login`, `/register`, `/reset-password`), verify:
- No uncaught JS errors in console
- Page has content (not blank)
- No "chunk load" errors (lazy loading works)

### 8. Create `e2e/login-form.spec.ts` (new)
Detailed login form interaction tests:
- Empty submit shows validation (HTML5 `required` attribute on inputs)
- Email field accepts input
- Password field accepts input
- "Forgot password" link navigates to `/reset-password`
- "No account" link navigates to `/register`
- Invalid credentials show error toast

## Technical Details

- All tests use `import { test, expect } from "../playwright-fixture"` (existing fixture)
- No authentication state is available, so all tests operate as unauthenticated users
- Protected route tests verify the redirect behavior of `ProtectedRoute` component
- Route list is derived from the 7 route files: `accountingRoutes`, `crmRoutes`, `salesRoutes`, `inventoryRoutes`, `hrRoutes`, `otherRoutes`, `settingsRoutes`
- The responsive tests will be updated to test actual existing routes
- Tests use resilient selectors: `getByRole`, `locator('input[id="email"]')`, URL pattern matching

## Summary of Deliverables

| File | Action | Tests |
|------|--------|-------|
| `e2e/auth.spec.ts` | Fix | 4 tests (updated selectors/routes) |
| `e2e/responsive.spec.ts` | Fix | ~8 tests (updated route list) |
| `e2e/navigation.spec.ts` | Fix | 3 tests (expect redirect when unauthenticated) |
| `e2e/invoice-flow.spec.ts` | Fix | 3 tests (expect redirect when unauthenticated) |
| `e2e/public-pages.spec.ts` | New | 5 tests |
| `e2e/route-protection.spec.ts` | New | ~30 tests (bulk route redirect checks) |
| `e2e/page-no-crash.spec.ts` | New | 3 tests |
| `e2e/login-form.spec.ts` | New | 5 tests |

Total: ~60 e2e tests covering authentication flow, route protection, public pages, responsive behavior, and page stability.


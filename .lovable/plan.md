

## Codebase Review — 28 Fixes Across 4 Priority Levels

This is a large, structured fix plan covering security vulnerabilities, broken functionality, database schema issues, and performance/quality improvements.

---

### Phase 1: P0 — Security Vulnerabilities (7 items)

**SEC-1 & SEC-2: `send-revers-notification` — Auth + tenant isolation**
- Add JWT auth via `getClaims()`, verify tenant membership
- Add `.eq("tenant_id", tenant_id)` to the `asset_reverses` query
- Return 401/403 for unauthorized callers

**SEC-3: `send-notification-emails` — Cron auth**
- Add `CRON_SECRET` check: verify `Authorization: Bearer <CRON_SECRET>` header
- Reject all other callers with 401

**SEC-4: `generate-pdf` — Payslip tenant check**
- After fetching payroll item, extract `tenant_id` from `payroll_runs`
- Call `verifyMembership()` before rendering payslip HTML

**SEC-5: `proactive-ai-agent` — Auth gate**
- Require either super_admin JWT or `CRON_SECRET` header
- Reject unauthenticated/unauthorized callers

**SEC-6: `ai-assistant` — Input validation for SQL interpolation**
- Add date regex validation (`/^\d{4}-\d{2}-\d{2}$/`) in `comparePeriods`, `forecastCashflow`, `analyzeTrend`, `detectAnomalies`
- Add numeric validation for `numMonths`, `days`, `changePct`

**SEC-7: `tenant-documents` storage — Cross-tenant RLS**
- Migration to drop existing storage policies and create tenant-scoped ones using `storage.foldername(name))[1]` matched against `tenant_members`

---

### Phase 2: P1 — Broken Functionality (7 items)

**BRK-1: `AssetDepreciation.tsx` — Wrong column names**
- Replace `depreciation_expense_account` → `expense_account_id`
- Replace `accumulated_depreciation_account` → `accumulation_account_id`
- Join `chart_of_accounts` to resolve UUID → account code

**BRK-2: `AssetReports.tsx` — Wrong order column**
- Change `.order("period_date")` → `.order("period_start", { ascending: false })`

**BRK-3: `calculate_depreciation_batch` RPC — Wrong column references**
- New migration replacing function body with correct column names from `fixed_assets` and `fixed_asset_details`

**BRK-4: Broken sidebar link**
- `hr/pppd-review` → `hr/payroll/pppd` (the 3 accounting links were already fixed)

**BRK-5: GlobalSearch dead routes**
- `/web/settings` → `/sales/web-settings`
- `/web/prices` → `/sales/web-prices`

**BRK-6: PayrollCostWidget wrong route**
- `"/hr/payroll/benchmark"` → `"/analytics/payroll-benchmark"`

**BRK-7: AI insight route fixes + deduplication**
- `duplicate_invoices` → `"/purchasing/supplier-invoices"`
- `expense_spike` → `"/accounting/expenses"`
- Extract `insightRouteMap` to `src/lib/insightRouteMap.ts` shared between `AiInsightsWidget` and `AiModuleInsights`

---

### Phase 3: P2 — Database Schema (9 items)

All via migration:

- **DB-1**: FK on `service_catalog.company_id` → `companies(id) ON DELETE CASCADE`
- **DB-2**: FK on `email_notification_log.user_id` → `auth.users(id) ON DELETE CASCADE`
- **DB-3**: FK on `verification_tokens.user_id` → `auth.users(id) ON DELETE CASCADE`
- **DB-4**: FKs on 11 audit columns across 9 tables → `auth.users(id) ON DELETE SET NULL`
- **DB-5**: Rename ERP `documents` table to `dms_documents` (or `IF NOT EXISTS` guard)
- **DB-6**: Fix `app_role` enum redefinition with `ADD VALUE IF NOT EXISTS`
- **DB-7**: Recreate `companies.tenant_id` FK with `ON DELETE CASCADE`; same for `company_categories`
- **DB-8**: Trigger on `profiles` DELETE to clean up orphan `bookkeeper_clients`
- **IDX-1**: 7 indexes on high-frequency query columns

---

### Phase 4: P3 — Performance & Code Quality (5 items)

**PERF-1**: Add `.limit(500)` to `InvoiceStatusChart` and `TopCustomersChart` queries

**PERF-2**: Add date filter (last 12 months) + `.limit()` to `ai-insights` journal_lines queries

**PERF-3**: HTML entity escaping in `generate-pdf` for all DB-sourced values

**CQ-1**: Add error handling to `markAsRead`/`markAllAsRead` in `useNotifications`

**CQ-2**: Add `tenantId` to query keys in `OpportunityActivityTab`, `OpportunityDiscussionTab`, `OpportunityDocumentsTab`

---

### Implementation Order

Given scope, recommend splitting into 3-4 implementation rounds:
1. **Round 1**: All P0 security fixes (SEC-1 through SEC-7)
2. **Round 2**: All P1 broken functionality (BRK-1 through BRK-7)
3. **Round 3**: P2 database migrations + P3 performance/quality fixes

Each round can be approved and implemented separately.


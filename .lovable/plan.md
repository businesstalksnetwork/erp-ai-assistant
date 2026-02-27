

## v2.4 Round 2 — HR Enhancements

### #4 Employee Document Uploads

**Approach**: Add a "Dokumenti" tab to `EmployeeDetail.tsx` using the `documents` table's polymorphic `entity_type`/`entity_id` pattern. Reuse the `OpportunityDocumentsTab` pattern (upload to `tenant-documents` storage bucket, insert row into `documents` with `entity_type = 'employee'`).

**Changes**:
- Create `src/components/hr/EmployeeDocumentsTab.tsx` — clone of `OpportunityDocumentsTab` adapted for employees, using `documents` table with `entity_type='employee'`, `entity_id=employeeId`
- Edit `src/pages/tenant/EmployeeDetail.tsx` — add "Dokumenti" tab trigger + content rendering `EmployeeDocumentsTab`
- Add translation keys: `employeeDocuments`

### #5 Employee Onboarding Checklists

**DB migration** — two new tables:
- `onboarding_checklists` (id, tenant_id, name, items JSONB `[{title, description}]`, is_active, created_at)
- `employee_onboarding_tasks` (id, tenant_id, employee_id FK, checklist_id FK, item_index int, completed bool default false, completed_at, completed_by)
- RLS: `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`

**Changes**:
- Create `src/components/hr/EmployeeOnboardingTab.tsx` — shows assigned checklist progress bar + task toggles; "Assign Checklist" button to pick from templates
- Edit `src/pages/tenant/EmployeeDetail.tsx` — add "Onboarding" tab
- Create `src/pages/tenant/OnboardingChecklists.tsx` — CRUD page for checklist templates (name + JSONB items editor)
- Add route `/hr/onboarding-checklists` in `hrRoutes.tsx`
- Add Settings link under Operations section in `Settings.tsx`
- Add translation keys

### #6 Payroll-Bank Reconciliation

**DB migration**:
- `payroll_bank_reconciliation` (id, tenant_id, payroll_run_id FK, bank_statement_line_id FK, employee_id FK, expected_amount numeric, matched_amount numeric, status text default 'unmatched', matched_at, notes)
- RLS: standard tenant isolation

**Changes**:
- Create `src/pages/tenant/PayrollBankReconciliation.tsx`:
  - Select a payroll run → load `payroll_items` with employee names + net_salary
  - Select bank statement(s) → load `bank_statement_lines` where `direction='outgoing'` and `transaction_type='SALARY'` or unmatched
  - Auto-match engine: compare employee name vs `partner_name` (fuzzy) + `net_salary` vs `amount` (exact/tolerance)
  - Display matched/unmatched items with manual override controls
  - Status badges: matched, unmatched, partial
- Add route `/hr/payroll/bank-reconciliation` in `hrRoutes.tsx`
- Add sidebar link in `TenantLayout.tsx` under HR/Payroll section
- Add translation keys

### Files Summary

| Action | File |
|--------|------|
| Create | `src/components/hr/EmployeeDocumentsTab.tsx` |
| Create | `src/components/hr/EmployeeOnboardingTab.tsx` |
| Create | `src/pages/tenant/OnboardingChecklists.tsx` |
| Create | `src/pages/tenant/PayrollBankReconciliation.tsx` |
| Create | Migration SQL (2 tables + RLS) |
| Edit | `src/pages/tenant/EmployeeDetail.tsx` (2 new tabs) |
| Edit | `src/routes/hrRoutes.tsx` (2 new routes) |
| Edit | `src/layouts/TenantLayout.tsx` (sidebar links) |
| Edit | `src/pages/tenant/Settings.tsx` (onboarding templates link) |
| Edit | `src/i18n/translations.ts` |


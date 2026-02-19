
# PRD v1.0 Enhanced — Gap Analysis & Upgrade Plan

## What the PRD Is

This is a comprehensive **Product Requirements Document** for an AI-powered Serbian ERP SaaS system. It specifies regulatory compliance requirements, module specifications, AI automation layers, and a 15-phase implementation roadmap.

## Current System Status (What's Already Built)

The codebase is already very well-developed. Most major modules exist:
- Multi-tenant architecture with RLS, RBAC, super-admin
- Sales: Quotes, Orders, Invoices, SEF integration, eOtpremnica
- Purchasing: POs, Goods Receipts, Supplier Invoices
- Inventory: Stock, Movements, WMS, FIFO cost layers
- Finance: Chart of Accounts, Journal Entries, GL, Trial Balance, PDV Periods, Bank Statements
- HR: Employees, Contracts, Payroll, Leave, Attendance
- Production: BOM, Production Orders
- CRM: Leads, Opportunities, Companies, Contacts
- POS + eFiskalizacija
- DMS: Documents, Archive, Approval Workflows
- AI: Assistant, Insights, Analytics Narrative

## Gap Analysis — Priority Upgrades from PRD

### GAP 1: Payroll Tax Parameters — Out of Date (HIGH PRIORITY)
The PRD specifies **2025 legal rates** that differ from what's currently seeded in `payroll_parameters`:
- **Nontaxable amount**: PRD says `28,423 RSD` — current code uses `34,221 RSD` (old value)
- **Min contribution base**: PRD says `45,950 RSD` — current code uses `51,297 RSD` (old value)
- **Max contribution base**: PRD says `656,425 RSD` — current code uses `732,820 RSD` (old value)
- **PIO employer rate**: PRD says `11%` — current code uses `10%`
- **Min hourly wage (net)**: PRD says `308 RSD/hour` — not yet in payroll_parameters

### GAP 2: Tax Parameter Engine — Missing UI (HIGH PRIORITY)
The PRD specifies a **Tax Parameter Engine** that allows updating tax rates per effective date without code changes. While `payroll_parameters` table exists in the DB, there is **no UI page** to view/edit these parameters. Admins must currently use SQL to update rates.

**Action**: Create `/settings/payroll-parameters` page showing the current 2025 rates with an edit form.

### GAP 3: Payroll Formula — PIO employer rate incorrect
PRD Section 7.2 specifies:
- PIO employee: 14%, PIO employer: **11%** (total 25%)
- Health employee: 5.15%, Health employer: 5.15% (total 10.3%)

The `calculate_payroll_for_run` function default fallback uses `pio_employer_rate = 0.10` (10%) instead of 11%.

### GAP 4: AI Audit Log — Schema Defined but No UI
The PRD specifies (Section 11.2) an **AI Audit Log** with fields: `timestamp`, `user_id`, `action_type`, `module`, `input_data`, `ai_output`, `model_version`, `confidence_score`, `user_decision`, `reasoning`.

The current system has a general `audit_log` table but no dedicated `ai_action_log` table, and no UI for reviewing AI decisions. The PRD explicitly requires this for regulatory compliance.

**Action**: Create a new `ai_action_log` table + a read-only UI page at `/settings/ai-audit-log`.

### GAP 5: Dashboard — Missing Predictive Widgets
The PRD (Section 6.1) requires:
- **Cashflow prediction** 30/60/90 days
- **Anomaly alerts** widget
- **Natural Language Query** ("Ask ERP" interface)

The dashboard has charts and an AI insights widget, but no dedicated 30/60/90 day cashflow prediction widget or an "Ask ERP" natural language interface.

**Action**: Add a Cashflow Forecast widget to the dashboard that shows 30/60/90 day projections based on open invoices + due dates.

### GAP 6: Settings — Missing "Payroll Parameters" and "AI Audit Log" links
The Settings page (`/settings`) currently has no link to payroll parameters or AI audit log pages.

### GAP 7: Compliance Calendar — Not Implemented
PRD Section 12.5 requires an **Automated Compliance Engine** with a **Zakonski Kalendar** (Legal Calendar) that tracks PDV deadlines, PP-PDV, EEPP, etc. Currently there is no compliance calendar/deadline tracker.

**Action**: Add a compliance deadline widget to the dashboard showing upcoming regulatory deadlines (PDV by 15th, SEF evidencije by 12th, etc.).

## Implementation Plan

### Phase 1: Update 2025 Tax Parameters (DB Migration)
Update the `payroll_parameters` default fallback values in `calculate_payroll_for_run` to match 2025 law:
- `nontaxable_amount`: 28,423 RSD
- `min_contribution_base`: 45,950 RSD
- `max_contribution_base`: 656,425 RSD
- `pio_employer_rate`: 0.11
- Insert correct 2025 parameters for all tenants that don't already have one

### Phase 2: Tax Parameter Engine UI
**New page**: `src/pages/tenant/PayrollParameters.tsx`
- Shows current effective payroll parameters
- Form to add new parameter set with `effective_from` date
- History of past parameter changes
- Linked from Settings page under "Finance" section

### Phase 3: AI Audit Log
**New DB table**: `ai_action_log` with fields from PRD Section 11.2
**New page**: `src/pages/tenant/AiAuditLog.tsx`
- Read-only table view of all AI actions
- Filterable by module, action_type, user_decision
- Linked from Settings page under "Operations" section

### Phase 4: Dashboard — Cashflow Forecast Widget + Compliance Calendar
**Enhanced Dashboard**:
- Add `CashflowForecastWidget` component (30/60/90 day view based on open invoices)
- Add `ComplianceDeadlineWidget` component showing:
  - Next PDV deadline (15th of month)
  - Next SEF evidencija deadline (12th of month)
  - Any open PDV periods not yet submitted
- These replace 2 of the less-used placeholder cards

### Phase 5: Settings Page — Add Missing Links
Add to the Settings page:
- "Payroll Parameters" link under Finance section
- "AI Audit Log" link under Operations section

## Files to Create/Modify

| File | Action | Reason |
|---|---|---|
| `supabase/migrations/` | NEW migration | Create `ai_action_log` table + update 2025 payroll params |
| `src/pages/tenant/PayrollParameters.tsx` | CREATE | Tax Parameter Engine UI |
| `src/pages/tenant/AiAuditLog.tsx` | CREATE | AI Audit Log viewer |
| `src/components/dashboard/CashflowForecastWidget.tsx` | CREATE | 30/60/90 day cashflow widget |
| `src/components/dashboard/ComplianceDeadlineWidget.tsx` | CREATE | Regulatory deadline tracker |
| `src/pages/tenant/Dashboard.tsx` | MODIFY | Add new widgets |
| `src/pages/tenant/Settings.tsx` | MODIFY | Add new settings links |
| `src/App.tsx` | MODIFY | Register new routes |
| `supabase/functions/calculate_payroll_for_run` (DB fn) | MODIFY via migration | Fix PIO employer rate default to 11% |

## Database Changes

**Migration 1**: Create `ai_action_log` table
```sql
CREATE TABLE public.ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid REFERENCES auth.users(id),
  action_type text NOT NULL,
  module text NOT NULL,
  input_data jsonb DEFAULT '{}',
  ai_output jsonb DEFAULT '{}',
  model_version text,
  confidence_score numeric,
  user_decision text CHECK (user_decision IN ('approved', 'rejected', 'modified', 'auto')),
  reasoning text,
  created_at timestamptz DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.ai_action_log
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
```

**Migration 2**: Seed 2025 payroll parameters for tenants missing them
```sql
INSERT INTO payroll_parameters (
  tenant_id, effective_from,
  tax_rate, nontaxable_amount,
  pio_employee_rate, pio_employer_rate,
  health_employee_rate, health_employer_rate,
  unemployment_rate,
  min_contribution_base, max_contribution_base
)
SELECT 
  t.id, '2025-01-01',
  0.10, 28423,
  0.14, 0.11,
  0.0515, 0.0515,
  0.0075,
  45950, 656425
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_parameters pp 
  WHERE pp.tenant_id = t.id AND pp.effective_from = '2025-01-01'
)
ON CONFLICT DO NOTHING;
```

## Expected Outcome

After these upgrades:
1. Payroll calculations are **legally compliant for 2025** (correct rates)
2. Admins can view and update tax parameters without SQL access
3. Every AI action is logged and auditable (regulatory compliance)
4. Dashboard shows **actionable forward-looking data** (cashflow + deadlines)
5. The system is demonstrably aligned with the PRD spec

These are the highest-impact gaps. The rest of the PRD (advanced FIFO costing UI, CROSO export, bank file generator for payments, PPP-PD auto-fill) represents Phase 2 work that can be planned separately.

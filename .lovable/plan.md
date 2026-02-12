

# Phase 18: Deep State Integrations -- Deferrals, Loans, Approvals & Aging

## Overview

Several modules have full CRUD but lack accounting integration or cross-module connectivity. This phase wires up Deferrals, Loans, Approval Workflows, and Aging Reports into the accounting and event systems.

---

## What Gets Built

### 1. Deferral Recognition Journal Entries (PRC)

**Current gap**: The "Recognize Period" button updates `recognized_amount` and creates a `deferral_schedules` row, but no journal entry is created.

**Fix**: After each recognition, create a journal entry:
- **Revenue deferral**: Debit `2500` (Deferred Revenue liability) / Credit `4000` (Revenue)
- **Expense deferral**: Debit `8000` (Expense) / Credit `1800` (Prepaid Expense asset)

New seeded accounts: `2500` (Deferred Revenue), `1800` (Prepaid Expenses)

### 2. Loan Payment Journal Entries

**Current gap**: Loans show an amortization schedule but payments are never recorded in the GL.

**Fix**: Add a "Record Payment" button on each loan schedule row:
- **Loan Payable (we owe)**: Debit `2200` (Loan Payable) for principal + Debit `8300` (Interest Expense) for interest / Credit `1000` (Bank)
- **Loan Receivable (owed to us)**: Debit `1000` (Bank) / Credit `1300` (Loan Receivable) for principal + Credit `4100` (Interest Income) for interest

New seeded accounts: `2200` (Loans Payable), `1300` (Loans Receivable), `8300` (Interest Expense), `4100` (Interest Income)

Track payments via a new `loan_payments` table to avoid double-recording.

### 3. Approval Workflow Enforcement

**Current gap**: Approval workflows are defined (entity type, threshold, required roles) but never checked. Invoices post, supplier invoices approve, and purchase orders confirm without any approval gate.

**Fix**: Create a reusable `useApprovalCheck` hook that:
1. Checks if an active approval workflow exists for the entity type
2. If amount exceeds threshold, blocks the action and shows an "Approval Required" dialog
3. Creates an `approval_requests` record (new table) and fires a `approval.requested` module event
4. The entity can only proceed once approval count meets `min_approvers`

Integrate into: Invoice posting, Supplier Invoice approval, Purchase Order confirmation.

### 4. Aging Report Auto-Generation

**Current gap**: AR/AP aging snapshot tables exist but are never populated. The page shows empty.

**Fix**: Add a "Generate Snapshot" button on the Aging Reports page that:
1. Queries all unpaid/partially-paid invoices (AR) and supplier invoices (AP)
2. Calculates days outstanding and buckets (current, 30, 60, 90, 90+)
3. Groups by partner and inserts snapshot rows
4. Shows the generated data immediately

### 5. Dashboard Enhancements

**Current gap**: Dashboard shows draft journals and overdue invoices but misses pending approvals and upcoming loan payments.

**Fix**: Add two more pending action cards:
- Pending approval requests count (from new `approval_requests` table)
- Upcoming loan payments (within next 7 days)

---

## Database Changes

### New Tables

**`loan_payments`**:
- `id`, `tenant_id`, `loan_id`, `period_number`, `payment_date`, `principal_amount`, `interest_amount`, `total_amount`, `journal_entry_id`, `created_at`

**`approval_requests`**:
- `id`, `tenant_id`, `workflow_id`, `entity_type`, `entity_id`, `requested_by`, `amount`, `status` (pending/approved/rejected), `approved_by`, `approved_at`, `created_at`

### Seeded Accounts

| Code | Name (EN) | Name (SR) | Type |
|------|-----------|-----------|------|
| 1300 | Loans Receivable | Potraživanja po kreditima | asset |
| 1800 | Prepaid Expenses | Unapred plaćeni troškovi | asset |
| 2200 | Loans Payable | Obaveze po kreditima | liability |
| 2500 | Deferred Revenue | Razgraničeni prihodi | liability |
| 4100 | Interest Income | Prihodi od kamata | revenue |
| 8300 | Interest Expense | Rashodi kamata | expense |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Deferrals.tsx` | Add journal entry creation in `recognizeMutation` |
| `src/pages/tenant/Loans.tsx` | Add "Record Payment" button per schedule row with journal entry creation; track in `loan_payments` |
| `src/pages/tenant/AgingReports.tsx` | Add "Generate Snapshot" button that computes buckets from live invoice data |
| `src/pages/tenant/Dashboard.tsx` | Add pending approvals count and upcoming loan payments |
| `src/hooks/useApprovalCheck.ts` | New hook for approval workflow enforcement |
| `src/pages/tenant/Invoices.tsx` | Integrate approval check before posting |
| `src/pages/tenant/SupplierInvoices.tsx` | Integrate approval check before approving |
| `src/pages/tenant/PurchaseOrders.tsx` | Integrate approval check before confirming |
| `src/i18n/translations.ts` | Add keys for new features |
| Database migration | Create `loan_payments` and `approval_requests` tables; seed new accounts |

---

## Technical Details

### Deferral Journal Pattern

```text
// Revenue deferral recognition:
Debit 2500 (Deferred Revenue): perPeriod
Credit 4000 (Revenue): perPeriod
Reference: "DEF-REV-{deferral_id}-period-{n}"

// Expense deferral recognition:
Debit 8000 (Expense): perPeriod
Credit 1800 (Prepaid Expenses): perPeriod
Reference: "DEF-EXP-{deferral_id}-period-{n}"
```

### Loan Payment Journal Pattern

```text
// Loan Payable (we pay):
Debit 2200 (Loans Payable): principal
Debit 8300 (Interest Expense): interest
Credit 1000 (Bank): total_payment
Reference: "LOAN-PAY-{loan_id}-{period}"

// Loan Receivable (we receive):
Debit 1000 (Bank): total_payment
Credit 1300 (Loans Receivable): principal
Credit 4100 (Interest Income): interest
Reference: "LOAN-RCV-{loan_id}-{period}"
```

### Approval Check Hook

```text
useApprovalCheck(entityType, amount, tenantId)
  -> returns { requiresApproval, checkAndProceed(onApproved) }
  -> checkAndProceed looks up active workflow for entityType
  -> if threshold_amount is set and amount < threshold, skip approval
  -> if approval needed, insert approval_requests row, show dialog, block action
  -> if existing approved request found for this entity, allow action
```

### Aging Snapshot Generation

```text
1. Fetch all invoices where status IN ('sent','overdue') for AR
2. For each invoice, calculate days = today - due_date
3. Bucket: current (<=0), 30 (1-30), 60 (31-60), 90 (61-90), 90+ (>90)
4. Group by partner_name, sum into buckets
5. Insert into ar_aging_snapshots with snapshot_date = today
6. Same logic for supplier_invoices -> ap_aging_snapshots
```

### i18n Keys to Add

recordPayment, paymentRecorded, loanPaymentJournal, deferralJournalCreated, generateSnapshot, snapshotGenerated, approvalRequired, approvalPending, pendingApprovals, upcomingPayments, requestApproval, approvalSubmitted, prepaidExpenses, deferredRevenue, loansPayable, loansReceivable, interestIncome, interestExpense




# Phase C: Compliance Features Implementation Plan

## 5 Items to Implement

### 1. HR-4: Employee Self-Service Portal
**What:** Dedicated pages where employees (not HR admins) can view their own payslips, leave balance, attendance, and submit leave requests.

**How:**
- Create `src/pages/tenant/MyPayslips.tsx` — lists payroll items for the logged-in employee's `employee_id`, with PDF download
- Create `src/pages/tenant/MyLeaves.tsx` — leave balance + request history + new request button (reuse `LeaveRequestDialog`)
- Create `src/pages/tenant/MyAttendance.tsx` — attendance log filtered to own records
- Create `src/pages/tenant/EmployeeDashboard.tsx` — summary cards: upcoming leave, last payslip, attendance this month
- Add 4 routes in `hrRoutes.tsx` under `hr/my-dashboard`, `hr/my-payslips`, `hr/my-leaves`, `hr/my-attendance`
- Employee ID lookup: query `employees` table by `user_id = auth.uid()`

### 2. HR-6: Education, Training & Certifications
**What:** Track employee qualifications, training records, and certifications with expiration alerts.

**How:**
- Migration: create `employee_education` (degree, institution, year), `employee_certifications` (name, issuer, issue_date, expiry_date, status), `employee_trainings` (title, provider, date, hours, cost) tables with tenant_id + employee_id FKs and RLS
- Add "Education & Skills" tab in `EmployeeDetail.tsx` with CRUD for all 3 record types
- Expiring certs highlighted (< 90 days = amber, < 30 days = red)

### 3. HR-7: Missing Payroll Forms (M-UN, OD-1, M-PD)
**What:** Serbian regulatory XML exports for employee registration/deregistration with CROSO.

**How:**
- Create 3 edge functions following the `generate-pppd-xml` pattern (auth → tenant check → query employees → build XML):
  - `generate-m-un-xml` — Prijava zaposlenog (registration)
  - `generate-od-1-xml` — Odjava zaposlenog (deregistration)  
  - `generate-m-pd-xml` — Promena podataka (data change)
- Each accepts `{ employee_id, tenant_id }`, queries employee + contract data, generates compliant XML
- Add download buttons in `HrReports.tsx` and `EmployeeDetail.tsx`

### 4. BANK-3: Payment Order Lifecycle
**What:** Full payment order management with draft→approved→sent→confirmed workflow.

**How:**
- Migration: `payment_orders` table (tenant_id, partner_id, amount, currency, sender_account, recipient_account, reference, payment_code, model, status, batch_id, created_by) + `payment_order_batches` table
- Create `src/pages/tenant/PaymentOrders.tsx` — list with status filters, batch actions
- Create `src/pages/tenant/PaymentOrderForm.tsx` — form with bank account selectors, NBS model/reference validation
- Status workflow using existing `useStatusWorkflow` hook
- Duplicate detection query (same partner + amount + date)
- Add routes in `accountingRoutes.tsx`

### 5. BANK-5: Halcom eBank File Export
**What:** Export payment order batches as Halcom-compatible XML for bank upload.

**How:**
- Create edge function `generate-halcom-xml/index.ts` — accepts batch_id, queries payment_orders in batch, generates NBS-standard XML (racun platioca, racun primaoca, šifra plaćanja, model, poziv na broj)
- Add "Export to Halcom" button on `PaymentOrders.tsx` batch view
- XML follows Halcom domestic payment schema with proper encoding (UTF-8, windows-1250 option)

---

## Summary

| Item | New Files | Migration Tables | Edge Functions |
|------|-----------|-----------------|----------------|
| HR-4 | 4 pages | 0 | 0 |
| HR-6 | 0 (tab in existing) | 3 tables | 0 |
| HR-7 | 0 (buttons only) | 0 | 3 |
| BANK-3 | 2 pages | 2 tables | 0 |
| BANK-5 | 0 (button only) | 0 | 1 |
| **Total** | **6 pages** | **5 tables** | **4 edge functions** |


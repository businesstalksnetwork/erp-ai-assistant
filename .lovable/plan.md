

## v2.3 Round 1 — P1 Quick Wins (4 items) ✅ COMPLETED

### Completed Items

**#9 — Cron schedule for recurring engines ✅**
**#10 — Recurring invoice line items ✅**
**#1 — OD-O Form ✅**
**#2 — M4 Annual PIO Report ✅**

---

## v2.3 Round 2 — P2 Quick Wins (4 items) ✅ COMPLETED

**#3 — ZPPPDV VAT Refund Form ✅**
- Created `src/pages/tenant/reports/ZpppdvForm.tsx`
- Reads from `pdv_periods`, filters where `input_vat > output_vat`
- Summary cards showing eligible periods and total refund amount
- Generates ZPPPDV XML for ePorezi submission
- Route: `/accounting/reports/zpppdv`, sidebar + global search

**#16 — Employee Data Export / Portability ✅**
- Created `src/pages/tenant/reports/EmployeeDataExport.tsx`
- PDPA compliant: exports personal data, attendance, leave, allowances, payroll history
- Supports JSON and CSV formats with BOM for Serbian characters
- Route: `/hr/employee-data-export`, sidebar + global search

**#17 — Lead → Partner Conversion Flow ✅**
- Added `convertToPartnerMutation` in `Leads.tsx`
- Creates partner record pre-filled from lead data (name, company, email, phone)
- New action button "Konvertuj u partnera" in lead action menu
- Marks lead as converted after partner creation

**#18 — Discount Approval Workflow ✅ (Already functional)**
- `useDiscountApproval` hook already wires discount approvals into `approval_requests`
- `PendingApprovals.tsx` already shows all pending approvals including `quote_discount` type
- No additional code needed — the pipeline was already complete

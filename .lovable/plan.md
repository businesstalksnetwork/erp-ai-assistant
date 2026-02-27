

## v2.3 Round 1 — P1 Quick Wins (4 items) ✅ COMPLETED

### Completed Items

**#9 — Cron schedule for recurring engines ✅**
**#10 — Recurring invoice line items ✅**
**#1 — OD-O Form ✅**
**#2 — M4 Annual PIO Report ✅**

---

## v2.3 Round 2 — P2 Quick Wins (4 items) ✅ COMPLETED

**#3 — ZPPPDV VAT Refund Form ✅**
**#16 — Employee Data Export / Portability ✅**
**#17 — Lead → Partner Conversion Flow ✅**
**#18 — Discount Approval Workflow ✅ (Already functional)**

---

## v2.3 Round 3 — P2 Modules (4 items) ✅ COMPLETED

**#5 — Direct Invoice Stock Deduction ✅**
- Invoice posting in `InvoiceForm.tsx` now emits `invoice.posted` module event
- `process-module-event` already has `handleInvoicePostedInventory` handler
- Automatically deducts stock via `adjust_inventory_stock` RPC when warehouse available
- Works alongside existing FIFO layer consumption

**#6 — Foreign Currency Cash Register (Devizna blagajna) ✅**
- Created `src/pages/tenant/FxCashRegister.tsx`
- Multi-currency cash in/out with exchange rate and RSD equivalent
- GL posting via posting rules engine (account 2440 — Devizna blagajna)
- Summary cards per currency, filter by month/currency
- Route: `/accounting/fx-cash-register`, sidebar + global search

**#14 — Data Retention Policy Enforcement ✅**
- Created `src/pages/tenant/DataRetentionPolicies.tsx`
- Configurable per-entity retention periods (contact, employee, lead, invoice, etc.)
- Action types: flag, archive, anonymize
- Manual enforcement run with execution logging
- Route: `/settings/data-retention`, sidebar + global search

**#15 — Data Breach Notification Mechanism ✅**
- Created `src/pages/tenant/SecurityIncidents.tsx`
- ZZPL Art. 52 compliant: 72-hour notification deadline tracking
- Severity levels: low/medium/high/critical
- Status workflow: detected → investigating → notified → resolved
- Dashboard with active/critical incident counts
- Route: `/settings/security-incidents`, sidebar + global search

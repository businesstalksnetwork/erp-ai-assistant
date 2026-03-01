

# 4-Star Improvements — Implementation Plan

## Existing vs New Assessment

After thorough codebase audit, here's the status of all 23 PRD items:

### Already Implemented (8 items — no work needed)
| Item | Evidence |
|------|----------|
| **HR-2** Travel orders | `TravelOrders.tsx`, `TravelOrderForm.tsx`, routes, GL posting |
| **HR-3** Non-employment income | `NonEmploymentIncome.tsx`, `calculate_non_employment_income` RPC |
| **HR-5** Offboarding | `AssetOffboarding.tsx` with checklist, asset return |
| **POS-1** Triple stock fix | `adjust_inventory_stock` only in refund path now |
| **POS-5** Discount approval | `DiscountApprovalRules.tsx`, `useDiscountApproval` hook |
| **BANK-1** Recon→invoice status | Fixed in CR4 batch |
| **BANK-7** Kompenzacija | `Kompenzacija.tsx` with AR/AP offsetting, GL posting |
| Onboarding checklists | `OnboardingChecklists.tsx` with templates & assignment |

### Needs Implementation (15 items)

---

## Phase A: Critical Fixes + Quick Wins (Week 1)

### 1. HR-1: Fix Sick Leave Enum (CR3-03)
- Audit `calculate_payroll_for_run` RPC for `'sick'` vs `'sick_leave'` enum mismatch
- Fix the leave_type check in the payroll RPC to match `work_logs`/`leave_requests` enum
- 1 migration

### 2. POS-6: Receipt Reprint + Cash Change
- Add receipt search dialog (by number, date, amount) in `PosTerminal.tsx`
- Reprint with "KOPIJA" header
- Cash change calculation: input "customer gives" → display change due
- ~200 lines added to POS

### 3. DMS-1: Transaction-Document Linking UI
- Create shared `AttachDocumentButton` and `TransactionDocumentsTab` components
- Wire into Invoice, Supplier Invoice, Journal Entry detail pages
- Query `documents` table by `entity_type`/`entity_id` (columns already exist)
- 2 new components + modifications to 3-4 transaction pages

---

## Phase B: High-Impact Features (Weeks 2-4)

### 4. POS-2: Split/Mixed Payments
- New `SplitPaymentDialog` component
- Support allocating total across cash + card + other methods
- Each method generates its own PFR payment entry
- Cash change for cash portion
- Migration: `pos_transaction_payments` table
- GL posting splits per payment method

### 5. POS-3: Product Category Navigation in POS
- Horizontal scrollable category bar above product grid
- Filter from `product_categories` table (already exists)
- "Most Popular" auto-category from recent 30-day sales
- ~150 lines in PosTerminal

### 6. POS-4: X-Report (Interim Shift Report)
- New `PosXReport.tsx` page or dialog within POS session
- Same aggregation as Z-report but without closing shift
- Cash count entry + variance display
- Multiple X-reports per shift

### 7. BANK-2: Partial Payment Matching
- Split match dialog showing open invoices for partner
- FIFO auto-allocation (oldest first)
- Manual amount-per-invoice entry
- Over/underpayment handling
- Migration: `bank_statement_line_matches` table (replaces single FK)

### 8. DMS-2: Document Templates
- `DocumentTemplates.tsx` page with template CRUD
- Rich text editor with `{{variable}}` insertion
- Predefined Serbian templates (Ugovor o radu, Potvrda, Odluka, etc.)
- Generate PDF from template with filled variables
- Migration: `document_templates`, `document_template_versions` tables

### 9. DMS-3: Document Approval Workflow
- Configurable approval chains per document category
- Reuse existing `approval_workflows` engine
- Status tracking: review → approve → sign → archive
- Migration: `document_workflows`, `document_approval_steps` tables

### 10. DMS-4+5: Full-Text Search + Trash UI + Thumbnails
- Add `tsvector` column + GIN index to documents table
- `search_documents` RPC with ranked results
- Drive trash folder UI (restore, permanent delete, empty trash)
- Thumbnail generation edge function for uploads

---

## Phase C: Compliance Features (Weeks 4-8)

### 11. HR-4: Employee Self-Service Portal
- New pages: `EmployeeDashboard.tsx`, `MyPayslips.tsx`, `MyLeaves.tsx`, `MyAttendance.tsx`
- Role-based routing (employee role → self-service pages)
- RLS policies: employees see only their own records
- Mobile-responsive layout
- Routes in `hrRoutes.tsx`

### 12. HR-6: Education, Training & Certifications
- Migration: `employee_education`, `employee_certifications`, `employee_trainings`, `employee_skills` tables
- New tab in `EmployeeDetail.tsx` for education/skills
- Expiration alerts (30/60/90 day warnings)
- Skills matrix view

### 13. HR-7: Missing Payroll Forms (M-UN, OD-1, M-PD)
- 3 new edge functions: `generate-m-un-xml`, `generate-od-1-xml`, `generate-m-pd-xml`
- Follow existing `generate-pppd-xml` pattern (auth, tenant check, query, XML generation)
- Download buttons in Payroll/HrReports pages

### 14. BANK-3: Payment Order Lifecycle
- `PaymentOrders.tsx` + `PaymentOrderForm.tsx` pages
- Status workflow: draft → approved → sent → confirmed → rejected
- Batch payment orders
- Duplicate detection (same amount + partner + date)
- Migration: `payment_orders`, `payment_order_batches` tables

### 15. BANK-5: Halcom eBank File Export
- Edge function: `generate-halcom-xml`
- NBS standard fields (racun platioca/primaoca, šifra plaćanja, model, poziv na broj)
- Batch export from payment order batches
- Download for manual upload to bank portal

---

## Phase D: Differentiation (Weeks 8-12)

### 16. BANK-4: Wire Transfer Templates
- `payment_templates` table migration
- Quick-fill from template when creating payment orders
- Auto-create template from first payment to partner

### 17. BANK-6: Interest Auto-Accrual
- Monthly interest accrual for active loans
- Default interest on overdue receivables (ZoOO Art. 278: ref rate + 8%)
- GL posting: DR 5620 / CR 4960 (loan), DR 2042 / CR 6720 (receivable)
- Migration: `interest_accruals` table

### 18. BANK-7b: Cesija & Asignacija
- Kompenzacija exists; add Cesija (AR transfer) and Asignacija (AP delegation)
- GL: DR 2040 new / CR 2040 original (cesija), DR 4350 supplier / CR 4350 new (asignacija)
- Migration: `cesije`, `asignacije` tables

### 19. DMS-6: OCR Integration
- Edge function using Tesseract or Cloud Vision API
- OCR button on uploaded images/scanned PDFs
- Store extracted text in `documents.ocr_text`
- Include in full-text search index

---

## Phase E: Premium (Weeks 12-16)

### 20. POS-7: Restaurant Mode
- Table layout editor (drag & drop), table status tracking
- Multi-course ordering, bill splitting
- Kitchen display (WebSocket)
- Migrations: `restaurant_tables`, `restaurant_orders`, `restaurant_reservations`

### 21. DMS-7: E-Signature Integration
- Edge functions for signature request/verification
- PDF.js overlay for signature placement
- Serbian qualified provider integration (MUP eID, Halcom)

---

## Summary

| Phase | Items | New Files | Migrations | Edge Functions |
|-------|-------|-----------|------------|----------------|
| A | 3 | ~4 components | 1 | 0 |
| B | 7 | ~8 pages/components | 4 | 1 |
| C | 5 | ~8 pages | 4 | 4 |
| D | 4 | ~4 pages | 3 | 1 |
| E | 2 | ~6 pages | 3 | 2 |
| **Total** | **21 new items** | **~30 files** | **15 migrations** | **8 edge functions** |

8 items already done. 15 items to implement across 5 phases.

Shall I start with Phase A (HR-1 sick leave fix, POS-6 receipt reprint + cash change, DMS-1 transaction-document linking)?


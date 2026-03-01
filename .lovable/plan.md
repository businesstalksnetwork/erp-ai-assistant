

# Phase 3: Module Upgrades

Based on PRD items and existing codebase analysis, Phase 3 covers 6 deliverables across HR, POS, Banking, and CRM.

---

## 3A: HR — Org Chart Visualization (HR-04)

**New file:** `src/pages/tenant/OrgChart.tsx`
- Recursive tree visualization built from `employees` table using `manager_id` / department hierarchy
- Card-based layout showing employee name, position, department, avatar
- Expand/collapse nodes, click to navigate to employee detail
- Route: `hr/org-chart`

---

## 3B: POS — Manager Override & Discount Approval (POS-01)

**Migration:** `pos_discount_overrides` table (tenant_id, transaction_id, original_price, override_price, discount_pct, reason, approved_by, requested_by, status, created_at)

**New file:** `src/pages/tenant/PosManagerOverride.tsx` — dashboard showing pending/approved overrides

**Edit:** `PosTerminal.tsx` — add "Request Discount" button that creates override request; managers see approval notification; approved discounts apply to cart item

Route: `pos/manager-overrides`

---

## 3C: POS — Loyalty POS Integration (POS-04)

**Edit:** `PosTerminal.tsx` — add loyalty member lookup (phone/card number), display tier/points, auto-accrue points on sale completion, allow point redemption as payment method

Uses existing `loyalty_members`, `loyalty_transactions`, `loyalty_programs` tables. No migration needed.

---

## 3D: Banking — Fuzzy Matching (BNK-01)

**Edit:** `BankStatements.tsx` — enhance reconciliation engine with:
- ±5% amount tolerance matching against open invoices
- Levenshtein-like name similarity on partner/payer names
- Confidence score display (exact match 100%, fuzzy 70-99%)
- Manual confirm/reject for fuzzy matches

No migration needed — works with existing `bank_statement_lines` and `invoices` tables.

---

## 3E: Banking — SEPA pain.001 XML Export (BNK-02)

**New file:** `src/pages/tenant/SepaExport.tsx` — select payment orders → generate SEPA pain.001 XML
- ISO 20022 XML structure: `<CstmrCdtTrfInitn>` with `<PmtInf>` blocks
- Pulls from `payment_orders` where status = confirmed
- Includes IBAN validation, BIC lookup
- Download as `.xml` file
- Route: `accounting/sepa-export`

---

## 3F: CRM — Quote Templates (CRM-02)

**Migration:** `quote_templates` table (tenant_id, name, description, items JSONB, terms_text, validity_days, currency, is_active)

**New file:** `src/pages/tenant/QuoteTemplates.tsx` — CRUD for reusable quote templates with line items, terms, and auto-fill from partner data

Route: `crm/quote-templates`

---

## Technical Summary

| Item | New Files | Migration Tables | Edits |
|------|-----------|-----------------|-------|
| 3A: Org Chart | 1 page | 0 | routes |
| 3B: Manager Override | 1 page | 1 table | PosTerminal, routes |
| 3C: Loyalty POS | 0 | 0 | PosTerminal |
| 3D: Fuzzy Matching | 0 | 0 | BankStatements |
| 3E: SEPA Export | 1 page | 0 | routes |
| 3F: Quote Templates | 1 page | 1 table | routes |
| **Total** | **4 pages** | **2 tables** | **4 edits** |

CRM-01 (credit limit checks) already exists in `useAccountingValidation.ts` and `CompanyDetail.tsx` — no action needed.


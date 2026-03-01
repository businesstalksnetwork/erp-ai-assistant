

# V3.3 Remaining Items — Implementation Plan

Three features remain, plus polish items. Here's the plan split into two manageable phases.

---

## Phase A: Partner Statement + CIT Advances

### 1. Kartica partnera (Partner Statement) — New Page
Create `src/pages/tenant/PartnerStatement.tsx`:
- Partner selector dropdown (from `partners` table)
- Date range filter
- Query `open_items` + `invoices` + `supplier_invoices` for the selected partner, ordered chronologically
- Display table: Date | Document | Debit | Credit | Running Balance
- Export to CSV
- Add route `accounting/partner-statement` in `accountingRoutes.tsx`
- Add sidebar nav link

### 2. CIT Quarterly Advance Payments
Extend `CitTaxReturn.tsx` with a new section:
- Once a CIT return exists for a year, calculate quarterly advances: `final_tax / 4`
- Display schedule table: Q1 (Apr 15), Q2 (Jul 15), Q3 (Oct 15), Q4 (Jan 15 next year)
- Add `paid` checkbox per quarter (stored in a new `cit_advance_payments` table)
- Migration: create `cit_advance_payments` table (tenant_id, cit_return_id, quarter, due_date, amount, paid, paid_date)

---

## Phase B: Non-Deductible Auto-Calc + Polish

### 3. Non-Deductible Expense Auto-Calculation
Add to `CitTaxReturn.tsx` adjustments section:
- Query journal_lines for accounts 5520 (representation) and 5530 (advertising) totals
- Auto-calculate: representation limit = total_revenue * 0.5%, advertising limit = total_revenue * 10%
- Show excess over limit as pre-filled `adjustIncrease` value
- Display breakdown: "Reprezentacija: X spent, Y limit, Z non-deductible"

### 4. Polish Items (P8 subset — code-only, no new tables)
- **P8-07**: Serbian locale months — ensure `toLocaleDateString('sr-Latn-RS')` used in date formatters
- **P8-08**: Account class validation — warn when posting to wrong class (e.g., revenue account in debit)
- Other P8 items (BOM cost, loyalty points, T-account view, etc.) deferred as lower priority

---

## Technical Summary

| Item | Scope | New Files | Migration |
|------|-------|-----------|-----------|
| Partner Statement | New page + route | 1 tsx | No |
| CIT Advances | Extend existing + new table | 0 | 1 migration |
| Non-deductible calc | Extend CitTaxReturn | 0 | No |
| Polish | Minor edits | 0 | No |


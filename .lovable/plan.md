

# POPDV Implementation Plan

This is a large-scale upgrade covering the full Serbian POPDV (VAT reporting) system. Given the scope (~20-24 day estimate in the PRD), I'll break it into implementable phases.

---

## Phase 1: Database Schema (Migration)

Create a single migration that:

1. **Create `popdv_tax_types` reference table** with all ~95 POPDV field entries from both Excel catalogs (OUTPUT, INPUT, BOTH directions), including `description_short`, `parent_id`, `is_special_record`, `popdv_section`, `sort_order`, `law_reference`
2. **Seed all POPDV types** — exact data from PRD Section 3.2 (OUTPUT sections 1-4, 6.1, 8a.4/8a.5, 8d, 8e.3/8e.4, 11; INPUT sections 4.1.2, 6, 7, 8a, 8b, 8v, 8g, 8d, 8e, 9, 11.8)
3. **Add `vat_date`** column to `invoices` and `supplier_invoices`, backfill from `invoice_date`, add filtered indexes
4. **Add `vat_non_deductible`** column to `invoice_lines` and `supplier_invoice_lines`
5. **Add `fee_value`** column to `supplier_invoice_lines`
6. **Add missing columns** to `supplier_invoice_lines`: `account_id`, `cost_center_id`, `tenant_id`
7. **Create `reverse_charge_entries`** table for tracking 8g→3a / 8b→3a auto-generated output entries
8. **Create `popdv_snapshots`** table for period snapshots with PP-PDV data
9. **RLS policies** on all new tables (tenant isolation)

---

## Phase 2: PopdvFieldSelect Component

Create `src/components/accounting/PopdvFieldSelect.tsx`:
- Fetches from `popdv_tax_types` table (cached 1 hour)
- Filters by `direction` prop (OUTPUT / INPUT / BOTH)
- Groups options by `popdv_section` with Serbian section labels
- Shows `description_short` with mono-font ID prefix
- Italic styling for `is_special_record` entries
- Uses existing `Select` component with `SelectGroup` / `SelectLabel`

---

## Phase 3: Update InvoiceForm.tsx (Izlazne)

1. **Remove** the hardcoded `POPDV_OPTIONS` array (lines 24-38)
2. **Import** and use `PopdvFieldSelect` with `direction="OUTPUT"` in line items table
3. **Add `vat_date` field** next to `invoiceDate` — auto-defaults to invoice date, editable, yellow highlight when different
4. **POPDV auto-default**: When tax rate changes and rate > 0, auto-suggest `3.2`; when partner is foreign, suggest `1.1` or `11.1`
5. **Save `vat_date`** in the save mutation alongside invoice data
6. **Full-width responsive** layout maintained

---

## Phase 4: Rework SupplierInvoices.tsx (Ulazne) — Major

The current page is header-only with no line items. Create a new `SupplierInvoiceForm.tsx` (similar to InvoiceForm) with:

1. **Line items table** with columns: description, item_type, POPDV (via `PopdvFieldSelect direction="INPUT"`), eFaktura, quantity, unit_price, tax_rate, line_total, tax_amount, vat_non_deductible, account (GL expense account via AccountCombobox)
2. **vat_date field** with same behavior as InvoiceForm
3. **POPDV auto-default**: `8a.2` for domestic VAT payer, `8g.1` for foreign entity, `6.2.1` for import
4. **Section 9 behavior**: When POPDV starts with `9`, populate `vat_non_deductible` instead of `tax_amount`
5. **Section 8v/8d behavior**: When POPDV starts with `8v` or `8d`, show `fee_value` field instead of base/VAT
6. **Save/load line items** to/from `supplier_invoice_lines` table
7. **Keep existing list view** in `SupplierInvoices.tsx`, add route for `/supplier-invoices/new` and `/supplier-invoices/:id`
8. **GL posting preview** before approval using `PostingPreviewPanel`

---

## Phase 5: Reverse Charge Auto-Generation

When a supplier invoice line has POPDV `8g.*` or `8b.*`:
1. Auto-create a corresponding entry in `reverse_charge_entries` table with the mapped output POPDV field (8g.1→3a.2, 8b.2→3a.2, etc.)
2. GL posting creates matching DR 2700 (Input VAT) / CR 4700 (Output VAT)
3. These entries feed into OUTPUT section 3a during POPDV aggregation
4. Implement as part of the approval/posting mutation in SupplierInvoiceForm

---

## Phase 6: POPDV Aggregation Engine

Create `src/lib/popdvAggregation.ts`:
1. Query output invoice lines by `vat_date` period, grouped by `popdv_field`
2. Query input supplier invoice lines by `vat_date` period, grouped by `popdv_field`
3. Include reverse charge entries as output 3a entries
4. Calculate Section 5 totals (output summary)
5. Calculate Section 8e (deductible input VAT = 8đ - Section 9)
6. Calculate Section 10 (net VAT = 5.7 - 8e.5)
7. Generate PP-PDV fields via documented formulas (PRD Section 14.2)
8. Store snapshots in `popdv_snapshots` table

---

## Phase 7: POPDV Form UI + PP-PDV

Update `PdvPeriods.tsx` to:
1. Show POPDV form with all 11 sections, pre-filled from aggregation
2. Allow manual adjustments before finalizing
3. Generate PP-PDV form from POPDV data
4. Export PP-PDV as XML for ePorezi filing

---

## Phase 8: Invoice Register Reports (Knjiga)

Create Knjiga izlaznih/ulaznih računa reports:
1. Group entries by POPDV section with subtotals
2. Show all 20 register columns per PRD Section 7.1
3. Filter by vat_date period
4. Export to PDF/Excel

---

## Implementation Order

Due to message size limits, I'll implement **Phases 1-4** first (database + PopdvFieldSelect + both invoice forms), then Phases 5-8 in a follow-up.

---

## Technical Notes

- The `popdv_tax_types` table uses `TEXT` primary keys (e.g., '3.2', '8a.2') for readability and direct use as POPDV field values
- All POPDV aggregation uses `vat_date`, never `invoice_date`
- `supplier_invoice_lines` needs `tenant_id` for RLS (currently missing)
- The eFaktura categories remain unchanged (S10, S20, AE10, AE20, Z, E, O, SS are correct per PRD Section 4)
- New route needed: `/accounting/supplier-invoices/new` and `/accounting/supplier-invoices/:id` for the line-item form


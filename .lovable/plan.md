

# Fix 4 Remaining Issues

## Issue 1: Auto-default POPDV 3.2 on InvoiceForm
**Already done.** Line 69 of `InvoiceForm.tsx` sets `popdv_field: "3.2"` in `emptyLine()`. No change needed.

## Issue 2: 8v/8d fee_value mode on InvoiceForm
**Not applicable.** 8v/8d fields are INPUT-side (supplier invoices only). The SupplierInvoiceForm already has this. Sales invoices (izlazne) don't use fee-based VAT calculation. No change needed.

## Issue 3: InvoiceForm "Proknjizi" button not working
The mutation code exists (lines 434–510) and the button renders (line 911). The issue is that `isReadOnly` on line 512 includes `status === "sent"`, which disables form editing — but the "Proknjizi" button should still be clickable. Need to verify this isn't blocked. The code at line 513 (`canPost = isEdit && status === "sent" && grandTotal > 0`) and button at line 913 both look correct.

**Likely runtime issue**: The `postWithRuleOrFallback` call passes `context: { partnerReceivableCode: "2040" }` but the function signature requires `DynamicContext` which may need more fields. Also, the `vatDate` state variable needs to be verified it exists — checking if InvoiceForm actually has a `vatDate` state variable.

**Action**: Read InvoiceForm around line 100-130 to check `vatDate` state, and verify the mutation can actually execute.

## Issue 4: Reverse charge line IDs using crypto.randomUUID()
**Bug confirmed.** In `SupplierInvoiceForm.tsx` line 352, `l.id || crypto.randomUUID()` passes fake UUIDs because `l.id` is undefined for newly created lines. The `supplier_invoice_lines` insert on line 341 doesn't return the inserted IDs.

**Fix**: Change the insert to `.insert(lineInserts).select("id, popdv_field, line_total, tax_amount")`, then use the returned data (with real DB-generated IDs) for the `createReverseChargeEntries` call.

## Files to modify
- `src/pages/tenant/SupplierInvoiceForm.tsx` — Fix reverse charge to use returned line IDs after insert
- `src/pages/tenant/InvoiceForm.tsx` — Verify/fix `vatDate` variable and ensure postMutation works end-to-end


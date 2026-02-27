

# Fix 6 Issues

## Issue 1: InvoiceRegister unreachable in UI
Add link to AccountingHub in "Porezi i periodi" section pointing to `/accounting/invoice-register`.

**File**: `src/pages/tenant/AccountingHub.tsx`
- Add `{ to: "/accounting/invoice-register", icon: FileText, label: "Knjiga računa", desc: "Knjiga izlaznih i ulaznih računa po POPDV sekcijama" }` to the "Porezi i periodi" section

## Issue 2: submit_pdv_period RPC doesn't exist
Replace the RPC call with a simple status update since the function doesn't exist in DB.

**File**: `src/pages/tenant/PdvPeriods.tsx` (lines 169-173)
- Replace `supabase.rpc("submit_pdv_period" as any, ...)` with `supabase.from("pdv_periods").update({ status: "submitted" }).eq("id", periodId)`

## Issue 3: Input register PIB always empty
The supplier_invoices table has `supplier_id` which references `partners.id`, and partners has `pib`. Join through supplier_id to get PIB.

**File**: `src/pages/tenant/InvoiceRegister.tsx` (lines 112-142)
- Change the supplier_invoices select to include `supplier_id`
- After fetching invoices, batch-fetch partner PIBs: `supabase.from("partners").select("id, pib").in("id", supplierIds)`
- Map PIB into the register entries

## Issue 4: Legal entity filter not applied
Add `.eq("legal_entity_id", legalEntityId)` to both output and input queries when `legalEntityId` is set and not `"__all"`.

**File**: `src/pages/tenant/InvoiceRegister.tsx` (lines 60-65, 112-117)
- After the `.lte("vat_date", periodEnd)` line, add conditional filter: `if (legalEntityId && legalEntityId !== "__all") query = query.eq("legal_entity_id", legalEntityId)`
- Apply to both output and input queries

## Issue 5: Reverse charge entries not cleaned up on re-save
Add delete of old reverse_charge_entries when editing an existing supplier invoice.

**File**: `src/pages/tenant/SupplierInvoiceForm.tsx` (line 322)
- After the `supplier_invoice_lines` delete, add: `await supabase.from("reverse_charge_entries").delete().eq("supplier_invoice_id", id!)`

## Issue 6: Remove unnecessary `as any` casts
**Files**: `PopdvFieldSelect.tsx`, `PdvPeriods.tsx`, `SupplierInvoiceForm.tsx`
- Remove `as any` from `.from("popdv_tax_types" as any)` → `.from("popdv_tax_types")`
- Remove `(period as any).legal_entity_id` → `period.legal_entity_id`
- Remove `(existing as any).vat_date` → `existing.vat_date`
- Remove snapshot upsert `as any` casts where types support the fields


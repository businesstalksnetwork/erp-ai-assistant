

# PRD V3.3 Full Implementation Plan — 6 Implementation Phases

This is a massive audit with ~140 items across 8 PRD phases. After cross-referencing with current code, many items are already fixed from previous rounds (1-7). Below is a triage of what remains open, organized into 6 manageable implementation phases.

---

## Already Fixed (Skipping)

The following were fixed in Rounds 1-7 and verified in code:
- P1-03 (POS triple stock — client-side removed, line 478 confirmed)
- P1-04, P1-05, P1-06, P1-09, P1-10, P2-02, P2-03, P2-06, P2-07, P2-08, P2-09, P2-10
- P3-02, P3-03, P3-04, P3-06, P3-08, P3-10, P3-14, P3-20, P3-22, P3-24, P3-25
- P4-04, P4-07, P4-13, P4-14, P4-15, P4-18, P4-19, P4-20
- CR-01 through CR-36 most items, CR2-01 through CR2-14 most items
- CR3-04 (Returns tax_amount), V3.3 security hardening (tenant_id deletes, getClaims migration)
- DeferredTax Math.abs() removed (confirmed no Math.abs in code)
- MultiPeriodReports Class 2 → PASIVA (confirmed line 76)
- CROSO namespace updated, SifraPlacanja removed, OsnovaOsiguranja added
- APR XML builder chaining fixed (line 66)

---

## Implementation Phase 1: CRITICAL — Payroll Stub & DB Cleanup (Migration)

**1 new migration fixing 3 critical DB issues:**

### 1a. CR3-01: Drop payroll stub overload
The migration `20260228124932` created a 2-arg stub `calculate_payroll_for_run(p_tenant_id UUID, p_run_id UUID)` that produces `net_salary=0, tax_amount=0`. This coexists with the real single-arg version. Must drop it.
```sql
DROP FUNCTION IF EXISTS public.calculate_payroll_for_run(uuid, uuid);
```

### 1b. CR3-02: Drop old POS overload  
Old `complete_pos_transaction(uuid, uuid, uuid, jsonb)` signature coexists with new 4-arg version.
```sql
DROP FUNCTION IF EXISTS public.complete_pos_transaction(uuid, uuid, uuid, jsonb);
```

### 1c. CR3-03: Fix sick leave enum in payroll RPC
The latest payroll RPC queries `leave_type = 'sick'` but the enum likely uses `'sick_leave'`. Need to verify actual enum values and align the RPC query.

---

## Implementation Phase 2: HIGH — SEF & Edge Function Fixes

### 2a. CR3-05: sef-cancel-sales-invoice error codes
**File:** `supabase/functions/sef-cancel-sales-invoice/index.ts`
Catch block returns 500 for all errors. Validation errors (missing fields, line 43-48) should return 400.

### 2b. CR-20: S10/S20 uses wall clock not invoice date
**File:** `supabase/functions/sef-send-invoice/index.ts` line 83
`determineVatCategory` already accepts `invoiceDate` param and uses it correctly (line 83: `invoiceDate ? new Date(invoiceDate) >= ...`). Need to verify callers pass invoice date. Check `generateUBLXml` call site.

### 2c. CR2-11: generate-apr-xml uses anon key for data queries
**File:** `supabase/functions/generate-apr-xml/index.ts` lines 26-56
Uses anon key client for data queries + `.single()` on membership check. Fix: use service_role for data, `.maybeSingle()` for membership.

### 2d. P3-07: SEF error HTTP status codes
**File:** `supabase/functions/sef-send-invoice/index.ts` lines 642+
Returns HTTP 200 with `success: false` for errors. Should return 4xx/5xx.

### 2e. P3-05: SEF storno hardcoded SS category
**File:** `supabase/functions/sef-send-invoice/index.ts` — storno path
`generateStornoUBLXml` hardcodes SS/0% for all credit notes regardless of original VAT.

---

## Implementation Phase 3: HIGH — Accounting & GL Fixes

### 3a. P3-12: InvoiceForm FIFO failure doesn't reverse GL
**File:** `src/pages/tenant/InvoiceForm.tsx` lines 533-537
If FIFO consumption fails after GL posting, invoice reverts to draft but GL remains. Must storno GL on failure.

### 3b. P3-13: 3-way match — price comparison missing
**File:** `src/pages/tenant/SupplierInvoices.tsx`
`performThreeWayMatch` only compares quantities, not prices.

### 3c. P3-15: Debit note missing VAT line
**File:** `src/pages/tenant/CreditDebitNotes.tsx`
Debit note GL posting credits 6000 with no VAT separation.

### 3d. P3-18: NBS exchange rate missing unit division
**File:** `supabase/functions/nbs-exchange-rates/index.ts`
JPY rate stored 100x too high (unit=100 not divided).

### 3e. P3-21: Invoice UI button labels misleading
**File:** `src/pages/tenant/InvoiceForm.tsx`
"Post to GL" button only changes status to "sent", doesn't post. Rename to match actual behavior.

### 3f. P3-23: Credit note SEF BillingReference missing
**File:** `src/pages/tenant/InvoiceForm.tsx` → `sef-submit`
Credit notes to SEF must include original invoice's `sef_invoice_id` as `billing_reference_number`.

---

## Implementation Phase 4: MEDIUM — Feature Completeness

### 4a. P4-01: Invoice line discount (rabat) field
Add `discount_percent` to invoice lines and update calculation.

### 4b. P4-02: Store vat_date on invoice record
`vat_date` (Datum prometa) required by ZoPDV Art. 42.

### 4c. P4-03: PB-1 — expand to ~70 AOP positions (currently 34)
Expand PoreskiBilans.tsx with all official line items.

### 4d. P4-08: PP-PDV XML root element & namespace fix
Fix root element to `ObrazacPPPDV` and namespace.

### 4e. P4-09: SEF credit note document type 381
Credit notes must use `CreditNote` root element in sef-submit.

### 4f. P4-16: Travel order per diem off-by-one
Add +1 for same-day trips.

### 4g. P4-17: Severance minimum enforcement
Add validation per ZoR Art. 118a.

### 4h. CR-27: KpoBook column name
KpoBook selects `total_amount` but the query (line 30) uses correct column names (`total_amount, subtotal, tax_amount`). Verify against actual schema.

---

## Implementation Phase 5: Missing Statutory Features (Key Subset)

### 5a. P5-01: Year-end closing (Zaključivanje)
Close Class 5→7, 6→7, transfer net to Class 3. Required for annual statements.

### 5b. P5-02: Prior year opening balances
Import/entry screen for beginning balances.

### 5c. P5-03: Fiscal period lock UI
`checkFiscalPeriodOpen` exists but no UI to lock/unlock.

### 5d. P5-04: Blagajnički dnevnik (Cash journal)
Daily sequential cash register journal.

### 5e. P5-05: Kartica partnera (Partner statement)
Chronological transaction history per partner with running balance.

### 5f. P5-13: Regres (Annual leave bonus)
Legally mandatory payment, needs OVP 205 PPP-PD row.

---

## Implementation Phase 6: Compliance & Polish

### 6a. P6-03: Quarterly CIT advance payments
Calculator and schedule tracking.

### 6b. P6-08: Non-deductible expense auto-calculation
Auto-calculate limits: representation 0.5%, advertising 10% of revenue.

### 6c. P7-06: eBolovanje JMBG checksum validation
Add mod-11 checksum (currently only checks 13 digits).

### 6d. P7-07: generate-apr-xml authorization fix
Uses anon key for data queries, needs service_role.

### 6e. P8-01 through P8-10: Polish items
BOM cost, loyalty points, POS cash reconciliation, production number sequence, T-account view, prior year comparison, Serbian locale months, account class validation, CIT/PB-1 merge.

---

## Technical Summary

| Phase | Items | Scope |
|-------|-------|-------|
| **1** | 3 | 1 migration (drop stubs + fix enum) |
| **2** | 5 | 4 edge functions modified |
| **3** | 6 | 3 frontend files + 1 edge function |
| **4** | 8 | 4 frontend + 2 edge functions |
| **5** | 6 | New pages + RPCs |
| **6** | 9 | Mixed compliance + polish |

**Total: ~37 actionable items remaining** (down from ~140 in the PRD, thanks to Rounds 1-7).

I recommend starting with **Phase 1** (payroll stub — highest risk, silent zero-value payslips) and **Phase 2** (SEF fixes — April 2026 deadline approaching).


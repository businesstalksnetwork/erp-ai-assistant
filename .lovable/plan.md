

## Audit: Disconnected and Non-Functional Features

After reviewing the entire codebase, here are all the features that are implemented and showing in the UI but are either not connected, don't actually work end-to-end, or are missing critical links.

---

### 1. Dispatch Notes (Otpremnice) -- Completely Standalone

**Where it shows:** Inventory Hub > "Otpremnice", DispatchNoteDetail page, SalesOrderDetail "Create Invoice" button

**What's broken:**
- The `dispatch_notes` table has `sales_order_id`, `invoice_id`, and `warehouse_id` columns, but the **Eotpremnica.tsx create form never saves any of them** -- it only saves sender/receiver text fields
- There is **no button anywhere** to create a dispatch note FROM a sales order or invoice -- it's always a blank manual form
- SalesOrderDetail has a "Create Invoice" button but **no "Create Dispatch Note" button** -- the ERP flow should be SO -> Dispatch Note -> Invoice, not SO -> Invoice directly
- Dispatch notes don't deduct inventory -- no `inventory_movements` are created when a dispatch note is confirmed/shipped
- No partner_id on the table or form, so dispatch notes can't be traced back to a customer

**Fix:** Add "Create Dispatch Note" button to SalesOrderDetail that pre-fills from SO data. Save `sales_order_id`, `warehouse_id`, and line items. On confirm, deduct inventory via `adjust_inventory_stock`.

---

### 2. Credit Notes -- No Journal Entry / No Invoice Link

**Where it shows:** Returns page > Credit Notes tab

**What's broken:**
- Credit notes are saved to the `credit_notes` table with `invoice_id` but issuing a credit note **never creates a journal entry** to reverse the revenue
- The return case "resolved" flow creates generic journal entries using hardcoded account codes (4000, 1200, 2100) but the credit note itself is just a record -- it doesn't reverse the original invoice's GL posting
- No mechanism to cancel/adjust the original invoice status when a credit note is issued
- Credit notes don't affect the `open_items` balance

**Fix:** When a credit note status changes to "issued", create a reversal journal entry and update the original invoice's remaining balance in open_items.

---

### 3. Insurance Records -- Not Linked to Employees

**Where it shows:** HR module > Insurance Records page

**What's broken:**
- The `insurance_records` table has an `employee_id` column, but `InsuranceRecords.tsx` **never sets it** -- the form only captures first_name, last_name, JMBG manually
- Records are never shown on the Employee Detail page
- No dropdown to select an employee -- data is entered as free text, duplicating employee info

**Fix:** Add employee selector to InsuranceRecords form, save `employee_id`, show insurance records tab on EmployeeDetail page.

---

### 4. Open Items -- Manual Sync Only, No Auto-Creation

**Where it shows:** Accounting > Open Items page

**What's broken:**
- Open items are only created via a manual "Sync" button that imports existing invoices
- When a new invoice is posted, it does NOT auto-create an open item -- you must manually click Sync
- Supplier invoices are synced but payments (mark as paid) don't auto-close the open item
- Kompenzacija (offset) page reads open items but after offset, the items aren't marked as closed in the open_items table

**Fix:** Add a database trigger or post-save hook on invoice posting to auto-create open items. When invoice is marked paid or kompenzacija is executed, auto-close matching open items.

---

### 5. Dispatch Notes Missing from SalesOrderDetail Flow

**Where it shows:** SalesOrderDetail page

**What's broken:**
- SalesOrderDetail only has "Create Invoice" -- no "Create Dispatch Note"
- The ERP document chain should be: Quote -> Sales Order -> Dispatch Note -> Invoice
- The dispatch note should inherit partner, warehouse, and line items from the SO

**Fix:** Add "Create Dispatch Note" button on SalesOrderDetail that navigates to the dispatch notes page with SO data pre-filled.

---

### 6. Bank Statement Matching -- No Auto-Close of Invoices

**Where it shows:** Accounting > Bank Statements page

**What's broken:**
- Bank statement lines can be manually matched to invoices, and a journal entry is created
- However, matching a bank statement line to an invoice does NOT update the invoice status to "paid"
- The user has to separately go to Invoices and click "Mark as Paid" even after bank reconciliation

**Fix:** When a bank statement line is matched to an invoice and the match journal is posted, auto-update the invoice status to "paid".

---

### 7. Supplier Invoice "Received" Status -- Dead State

**Where it shows:** Supplier Invoices page

**What's broken:**
- The status flow is: draft -> received -> approved -> paid
- But there is no automatic transition from "draft" to "received" -- the user must manually edit the status
- The "Approve" button only appears for "received" status, so a newly created supplier invoice cannot be approved without first manually changing status to "received"
- Import from PO creates the invoice in "draft" status, requiring an extra manual step

**Fix:** Either auto-set new supplier invoices to "received" status, or show the "Approve" button for both "draft" and "received" statuses.

---

### 8. Deferrals -- No Legal Entity Link

**Where it shows:** Accounting > Deferrals page

**What's broken:**
- Deferrals form has no legal entity selector
- When the "Post Schedule" action creates journal entries via `createCodeBasedJournalEntry`, no `legal_entity_id` is passed
- In multi-entity tenants, deferral postings can't be attributed to the correct entity

**Fix:** Add `legal_entity_id` to the deferrals form and pass it through to journal entry creation.

---

### 9. Fixed Assets -- Missing Depreciation Auto-Run

**Where it shows:** Accounting > Fixed Assets page

**What's broken:**
- Fixed assets have a "Run Depreciation" button that creates a single journal entry
- But there is no scheduled/batch depreciation -- you must click the button individually for each asset each month
- No indication of which assets have already been depreciated for the current period

**Fix:** Add a "Run All Depreciation" batch button that processes all active assets for the current period, skipping those already depreciated.

---

### 10. SalesOrderDetail "Create Invoice" -- Missing Line Items

**Where it shows:** SalesOrderDetail page

**What's broken:**
- The "Create Invoice" button on SalesOrderDetail.tsx (line 163-175) passes `partner_id`, `partner_name`, `currency`, and `sales_order_id` to InvoiceForm via navigation state
- But it does NOT pass the sales order LINES -- the user must re-enter all line items on the invoice
- The fix in SalesOrders.tsx (list page) was done in the previous batch, but the SalesOrderDetail page was missed

**Fix:** Fetch `sales_order_lines` before navigating and include them in the `fromSalesOrder` state object so InvoiceForm pre-fills them.

---

### Summary Table

| # | Feature | Where it Shows | What's Broken |
|---|---------|---------------|--------------|
| 1 | Dispatch Notes | Inventory Hub | Not linked to SO/Invoice, no inventory deduction |
| 2 | Credit Notes | Returns module | No journal entry on issue, no invoice adjustment |
| 3 | Insurance Records | HR module | Not linked to employees |
| 4 | Open Items | Accounting | Manual sync only, no auto-create/close |
| 5 | SO -> Dispatch Note | SalesOrderDetail | Button doesn't exist |
| 6 | Bank Statement Match | Accounting | Doesn't auto-mark invoice as paid |
| 7 | Supplier Invoice Status | Purchasing | "Draft" can't be approved directly |
| 8 | Deferrals | Accounting | Missing legal entity |
| 9 | Fixed Assets Depreciation | Accounting | No batch run, no period tracking |
| 10 | SO Detail -> Invoice | SalesOrderDetail | Line items not passed |

### Implementation Approach

**Phase 1 -- Critical flow fixes (items 1, 2, 5, 10):** These break the core document chain. Fix dispatch notes, credit note postings, add SO->Dispatch Note button, and fix SO Detail invoice creation.

**Phase 2 -- Automation fixes (items 4, 6, 7):** These require manual workarounds currently. Auto-create open items, auto-close on bank match, fix supplier invoice status flow.

**Phase 3 -- Link fixes (items 3, 8, 9):** These are data integrity issues. Link insurance to employees, add legal entity to deferrals, add batch depreciation.

### Files to Change

| File | Changes |
|------|---------|
| `Eotpremnica.tsx` | Save `sales_order_id`, `warehouse_id`; add partner selector; create inventory movements on confirm |
| `SalesOrderDetail.tsx` | Add "Create Dispatch Note" button; fix "Create Invoice" to pass line items |
| `Returns.tsx` | Create reversal journal entry when credit note is issued |
| `InsuranceRecords.tsx` | Add employee selector, save `employee_id` |
| `EmployeeDetail.tsx` | Add Insurance Records tab |
| `OpenItems.tsx` | Add trigger/hook for auto-creation on invoice post |
| `BankStatements.tsx` | Auto-update invoice status on match |
| `SupplierInvoices.tsx` | Show Approve button for "draft" status too |
| `Deferrals.tsx` | Add legal entity selector, pass to journal creation |
| `FixedAssets.tsx` | Add "Run All" batch depreciation with period tracking |


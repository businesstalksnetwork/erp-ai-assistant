

## e-Otpremnice UI + Architecture Hardening

### Overview

Migrate the dispatch notes frontend from the legacy `eotpremnica` table to the new `dispatch_notes` / `dispatch_note_lines` / `dispatch_receipts` schema created in Tier 2, and add line-item management, a detail page, and receipt confirmation. Also apply targeted architecture improvements.

---

### Part 1: e-Otpremnice UI Rebuild

#### 1.1 Rewrite `Eotpremnica.tsx` to use `dispatch_notes` table
- Query `dispatch_notes` instead of `eotpremnica`
- Map all new columns: `sender_city`, `receiver_city`, `transport_reason`, `dispatch_date`, `eotpremnica_status`
- Create form includes all new fields (cities, transport reason, warehouse picker, linked sales order/invoice selectors)
- Status workflow remains: draft -> confirmed -> in_transit -> delivered
- API submit button calls `eotpremnica-submit` with `dispatch_note_id` instead of `eotpremnica_id`

#### 1.2 New detail page: `DispatchNoteDetail.tsx`
- Route: `/inventory/dispatch-notes/:id`
- Header card with dispatch note metadata (sender/receiver info, transport details, status badge, eOtpremnica status)
- **Lines tab**: Table of `dispatch_note_lines` with add/edit/delete for draft status
  - Product picker (from `products` table), description, quantity, unit, lot number, serial number
- **Receipts tab**: Shows linked `dispatch_receipts` with status
  - "Create Receipt" button (when status = `in_transit` or `delivered`)
  - Receipt form: receipt number, date, warehouse, notes
- Status transition buttons in header
- API submit button in header

#### 1.3 Route registration
- Add `DispatchNoteDetail` route in `App.tsx`: `inventory/dispatch-notes/:id`
- Table rows in list page become clickable, navigating to detail

#### 1.4 Translation keys
- Add ~15 new keys to `translations.ts`: `dispatchDate`, `transportReason`, `senderCity`, `receiverCity`, `lineItems`, `lotNumber`, `serialNumber`, `addLine`, `receipts`, `createReceipt`, `receiptNumber`, `receiptDate`, `receivedBy`

#### 1.5 Update `eotpremnica-submit` edge function
- Accept `dispatch_note_id` parameter alongside legacy `eotpremnica_id`
- Update `dispatch_notes.eotpremnica_status` and `eotpremnica_sent_at` on success

---

### Part 2: Architecture Hardening

#### 2.1 Extract reusable status workflow hook
- Create `useStatusWorkflow.ts` hook that encapsulates the status mutation pattern used in Eotpremnica, InternalTransfers, SalesOrders, etc.
- Reduces ~20 lines of boilerplate per page

#### 2.2 Memoize filtered lists
- Add `useMemo` for client-side filter operations in the dispatch notes list (and pattern for other list pages)

#### 2.3 Type safety
- Replace `any` casts in Eotpremnica with proper types from `Database["public"]["Tables"]["dispatch_notes"]["Row"]`

---

### Technical Details

**Files to create:**
- `src/pages/tenant/DispatchNoteDetail.tsx` — Detail page with lines + receipts tabs
- `src/hooks/useStatusWorkflow.ts` — Reusable status mutation hook

**Files to modify:**
- `src/pages/tenant/Eotpremnica.tsx` — Rewrite to use `dispatch_notes`
- `src/App.tsx` — Add detail route
- `src/i18n/translations.ts` — Add new keys
- `supabase/functions/eotpremnica-submit/index.ts` — Support `dispatch_note_id`

**No database migrations needed** — the `dispatch_notes`, `dispatch_note_lines`, and `dispatch_receipts` tables already exist from Tier 2.


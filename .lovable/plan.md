
# Phase 5: Advanced Features

## Overview

Four enhancements that elevate existing scaffolding into functional systems: (1) a working approval engine with multi-step chains, (2) WMS slotting wired to the AI Edge Function, (3) production orders auto-selecting BOM materials, and (4) FX revaluation connected to NBS exchange rates.

---

## 1. Approval Workflow Engine -- Multi-Step Chains

### Current State
- `approval_workflows` table stores rules (entity_type, min_approvers, threshold_amount, required_roles)
- `approval_requests` table tracks pending/approved/rejected status
- `approval_steps` table exists (request_id, approver_user_id, action, comment, acted_at) but is never written to
- `useApprovalCheck` hook creates requests and checks status but never handles multi-step approval logic
- No UI exists for approvers to review and act on pending requests

### Changes

**A. New page: Pending Approvals** (`src/pages/tenant/PendingApprovals.tsx`)
- Lists all `approval_requests` with status `pending` for the current tenant
- Shows entity_type, requested_by (user name), created_at, and the workflow name
- Each row has "Approve" and "Reject" buttons (with optional comment field)
- Clicking Approve inserts into `approval_steps` with `action: 'approved'`
- After each step, checks if `approval_steps` count for that request >= `workflow.min_approvers` -- if so, updates `approval_requests.status` to `approved`
- Rejecting any step sets the request to `rejected`
- Role-gate: only users whose role is in `workflow.required_roles` can see and act on requests

**B. Update `useApprovalCheck` hook** (`src/hooks/useApprovalCheck.ts`)
- After creating a request, fire a notification via `create-notification` Edge Function to users with matching roles
- When checking if approved, also verify the step count meets `min_approvers`

**C. Add route and navigation**
- Add `/approvals` route in `App.tsx`
- Add navigation link in `TenantLayout.tsx` sidebar under a "Settings" or "Admin" group

**D. Add translation keys** for approve, reject, comment, pendingApprovals, approvalHistory

---

## 2. WMS Slotting -- Connect to AI Edge Function

### Current State
- `wms-slotting` Edge Function exists with full AI gateway integration (velocity analysis, co-occurrence, bin scoring)
- `WmsSlotting.tsx` page has a local client-side algorithm that does basic accessibility sorting -- it does NOT call the Edge Function
- Both produce scenario + move records in the same tables

### Changes

**A. Update `WmsSlotting.tsx`** (`src/pages/tenant/WmsSlotting.tsx`)
- Replace the client-side `runAnalysisMutation` logic with a call to `supabase.functions.invoke("wms-slotting", { body: { warehouse_id, tenant_id, weights } })`
- Map the AI response (`recommendations` array) to `wms_slotting_moves` inserts
- Store `estimated_improvement` from the AI response on the scenario record
- Keep the existing scenario creation (insert with status `analyzing`), then update to `completed` with results after the Edge Function returns
- Add a loading state with "AI is analyzing..." indicator since the AI call takes a few seconds

**B. Add "Use AI" toggle** (optional enhancement)
- Allow users to choose between the fast local algorithm and the AI-powered analysis
- Default to AI mode

---

## 3. Production Module -- BOM-to-Order Wiring

### Current State
- `BomTemplates.tsx` has full CRUD for BOM templates with material lines
- `ProductionOrders.tsx` has a `bom_template_id` selector but creating an order does NOT auto-populate material lines
- `ProductionOrderDetail.tsx` shows BOM lines from the linked template and has material availability checking
- `complete_production_order` RPC handles atomic material consumption and finished goods receipt
- Missing: when creating a production order and selecting a BOM, the system should auto-fill the product from the BOM template

### Changes

**A. Auto-fill product from BOM selection** (`src/pages/tenant/ProductionOrders.tsx`)
- When user selects a `bom_template_id` in the create/edit dialog, auto-populate `product_id` from the BOM template's `product_id` field
- Fetch BOM templates with their `product_id` included in the query

**B. Show material summary in create dialog**
- After BOM selection, fetch and display `bom_lines` inline as a read-only summary showing what materials will be consumed
- Show total estimated cost based on `default_purchase_price` from the material products

**C. Add "Create from BOM" shortcut on BomTemplates page** (`src/pages/tenant/BomTemplates.tsx`)
- Add a button on each BOM row: "Create Order" that navigates to ProductionOrders with the BOM pre-selected
- Use URL search params or state to pass the BOM template ID

---

## 4. Multi-Currency Revaluation -- Connect to NBS Rates

### Current State
- `FxRevaluation.tsx` is fully functional: previews open items, calculates gains/losses, posts journal entries
- It queries `exchange_rates` table for the revaluation date
- `nbs-exchange-rates` Edge Function fetches and stores rates in `exchange_rates`
- Missing link: if no rates exist for the selected date, user gets no results with no explanation

### Changes

**A. Add "Fetch NBS Rates" button** (`src/pages/tenant/FxRevaluation.tsx`)
- Before the "Preview" button, add a "Fetch Rates for Date" button that calls `nbs-exchange-rates` Edge Function with the selected `revalDate`
- Shows a success toast with the number of rates imported
- After fetching, auto-trigger the preview

**B. Add rate availability indicator**
- Query `exchange_rates` for the selected date and show which currencies have rates available
- Show a warning badge if rates are missing for currencies used in open items
- Display the rate source (NBS) and date next to each rate in the preview table

**C. Add "Latest Available Rate" fallback**
- If no rate exists for the exact revaluation date, offer to use the most recent available rate (with a warning indicator)
- Add a toggle: "Use latest available rate if exact date not found"

---

## Technical Details

### Files Created
1. `src/pages/tenant/PendingApprovals.tsx` -- Approval review and action page

### Files Modified
1. `src/hooks/useApprovalCheck.ts` -- Add notification dispatch and multi-step verification
2. `src/pages/tenant/WmsSlotting.tsx` -- Replace local algorithm with Edge Function call
3. `src/pages/tenant/ProductionOrders.tsx` -- Auto-fill product from BOM, show material summary
4. `src/pages/tenant/BomTemplates.tsx` -- Add "Create Order" shortcut button
5. `src/pages/tenant/FxRevaluation.tsx` -- Add NBS rate fetching, availability indicator, fallback logic
6. `src/App.tsx` -- Add `/approvals` route
7. `src/layouts/TenantLayout.tsx` -- Add Pending Approvals nav link
8. `src/i18n/translations.ts` -- Add translation keys

### No Database Changes Required
All tables exist: `approval_workflows`, `approval_requests`, `approval_steps`, `wms_slotting_scenarios`, `wms_slotting_moves`, `exchange_rates`, `bom_templates`, `bom_lines`, `production_orders`.

### Key Integration Points

**Approval flow**:
```text
User action (e.g. post invoice)
  -> useApprovalCheck: finds matching workflow
  -> If amount >= threshold: creates approval_request (pending)
  -> Notifies approvers via create-notification
  -> Approver opens PendingApprovals page
  -> Approver clicks Approve -> inserts approval_step
  -> If steps >= min_approvers -> request status = approved
  -> Original action can now proceed
```

**WMS Slotting flow**:
```text
User selects warehouse + weights -> clicks Run Analysis
  -> Creates scenario record (status: analyzing)
  -> Calls wms-slotting Edge Function (AI gateway)
  -> AI returns recommendations + estimated_improvement
  -> Saves results to scenario, creates slotting_moves
  -> User reviews moves -> clicks Generate Tasks
  -> Creates wms_tasks (type: reslot) for warehouse workers
```

**FX Revaluation flow**:
```text
User picks date -> clicks Fetch NBS Rates
  -> Calls nbs-exchange-rates Edge Function for that date
  -> Rates stored in exchange_rates table
  -> User clicks Preview
  -> System matches open items to rates, calculates differences
  -> User clicks Post -> journal entry created (5072/6072 accounts)
```

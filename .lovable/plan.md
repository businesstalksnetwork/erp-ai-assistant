

## Update ARCHITECTURE_DOCUMENTATION.md with All New Features

### Overview

Update the architecture documentation to reflect all changes from Tier 2 (database schema), Tier 3 (AI enhancements), e-Otpremnice UI rebuild, and architecture hardening work.

---

### Changes to Apply

#### 1. Version & Date Update (Line 3-4)
- Update version to 2.0
- Update date to current

#### 2. Section 1.3 Tech Stack (Line 40-51)
- Update edge function count from "63+" to "65+" (new functions added)
- Add `react-markdown` to dependencies

#### 3. Section 3.1 Module Overview — Inventory Row (Line 165)
- Add `dispatch_notes`, `dispatch_note_lines`, `dispatch_receipts` tables to the Inventory module
- Add `eotpremnica-submit` edge function reference
- Update page count

#### 4. Section 4.1.6 Inventory & WMS Tables (after Line 331)
- Add new table entries:
  - `dispatch_notes`: Document number, sender/receiver info, cities, transport reason, status workflow, eotpremnica_status
  - `dispatch_note_lines`: Product lines with lot/serial tracking
  - `dispatch_receipts`: Receipt confirmation (prijemnica) records

#### 5. Section 4.2 Key Database Functions (after Line 421)
- Add `execute_readonly_query(query_text)` RPC function — used by AI assistant for safe tenant-scoped SQL execution (service_role only, SELECT-only, 10s timeout)

#### 6. Section 5.1 AI Functions (Lines 469-484)
- Rewrite `ai-assistant` description to reflect tool-calling loop with SQL query capability
- Add details about `execute_readonly_query` RPC integration
- Document 3-round tool-calling loop, SQL validation, tenant scoping
- Update `ai-insights` description to include anomaly detection capabilities:
  - Expense spikes (>50% MoM)
  - Duplicate supplier invoices (same supplier + amount within 3 days)
  - Weekend posting detection
  - Dormant/at-risk partner alerts
  - Slow-moving inventory detection

#### 7. Section 5.11 Other Functions — eotpremnica-submit (Line 597)
- Update to note it now supports both `dispatch_note_id` (new) and legacy `eotpremnica_id`

#### 8. Section 6.3 Inventory Routes (Lines 726-748)
- Add new route: `/inventory/dispatch-notes/:id` -> `DispatchNoteDetail`

#### 9. Section 7.3 Custom Hooks Inventory (Lines 885-898)
- Add `useStatusWorkflow()` hook — reusable status mutation pattern for draft/confirmed/in_transit/delivered workflows

#### 10. New Feature Deep-Dive: Section 8.9 — Dispatch Notes (e-Otpremnice)
Add new subsection after Section 8.8 documenting:
- Dispatch note lifecycle: draft -> confirmed -> in_transit -> delivered
- eOtpremnica API submission flow (dispatch_note_id -> eotpremnica-submit -> status update)
- Line items management (product picker, lot/serial tracking)
- Receipt (prijemnica) workflow
- Detail page with Lines + Receipts tabs

#### 11. New Feature Deep-Dive: Section 8.10 — AI SQL Tool Calling
Add new subsection documenting:
- Tool-calling loop architecture (up to 3 rounds)
- SQL validation rules (SELECT-only, tenant_id scoping, keyword blocklist)
- `execute_readonly_query` RPC function
- Schema context injection
- SSE streaming of final response

#### 12. New Feature Deep-Dive: Section 8.11 — AI Anomaly Detection
Add subsection documenting the 7 anomaly detection checks in `ai-insights`

#### 13. Update Appendix / Footer (Line 1632)
- Update version, total routes count (~155+), edge functions count (65+), table count

---

### Technical Details

**File to modify:**
- `ARCHITECTURE_DOCUMENTATION.md` — Full rewrite with all new sections
- `COMPLETE_CODEBASE_REVIEW.md` — Update hook count, route count, function count, and add new features summary

No code changes — documentation only.


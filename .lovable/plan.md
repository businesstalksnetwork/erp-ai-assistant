

# E2E Connectivity Review: Warehouses, Sales, Retail, Invoices, Quotes, CRM, Analytics, AI

## Status Summary

| Area | GL Posting | AI Narrative | Data Flow | Verdict |
|------|-----------|-------------|-----------|---------|
| Magacini (Warehouses/Inventory) | OK (via RPCs) | MISSING | OK | Needs AI |
| Veleprodaja (Wholesale/Sales) | OK (via RPCs) | MISSING | OK (Quote→SO→Dispatch→Invoice chain works) | Needs AI |
| Maloprodaja (POS) | OK (`process_pos_sale` RPC) | MISSING | OK | Needs AI |
| Fakture (Invoices) | OK (`process_invoice_post` + `create_journal_from_invoice` RPCs) | MISSING | OK | Needs AI |
| Ponude (Quotes) | N/A (no GL needed) | MISSING | OK (→ Sales Order conversion works) | Needs AI |
| CRM | N/A | WRONG contextType | OK | Bug fix needed |
| Analytics (15 pages) | N/A | ALL CONNECTED | N/A | OK |
| AI Insights | N/A | N/A | OK (edge function supports all 21 context types) | OK |

---

## Issue 1: CRM Dashboard Uses Wrong AI Narrative Context

**File**: `src/pages/tenant/CrmDashboard.tsx` line 225
**Bug**: `contextType="planning"` instead of `contextType="crm_pipeline"`

The edge function already has a dedicated `crm_pipeline` system prompt ("You are a sales pipeline analyst AI...") but the CRM dashboard sends `"planning"` instead, so it gets generic business planning recommendations instead of pipeline-specific analysis.

**Fix**: Change `contextType="planning"` to `contextType="crm_pipeline"` on line 225.

---

## Issue 2: AI Narrative Context Map Missing Key Modules

**File**: `src/components/ai/AiContextSidebar.tsx` lines 98-112

The `getNarrativeContext` function maps URL paths to AI narrative contexts. It only covers `/analytics/*` and `/dashboard`. These modules are missing:

| Path | Context Type (already exists in edge function) |
|------|----------------------------------------------|
| `/crm` or `/crm/*` | `crm_pipeline` |
| `/pos` or `/pos/*` | `pos_performance` |
| `/production` or `/production/*` | `production` |
| `/hr` or `/hr/*` | `hr_overview` |
| `/purchasing` or `/purchasing/*` | `purchasing` |
| `/sales` or `/sales/*` | (no context type defined yet -- could reuse `dashboard` or add a new `sales_performance` type) |
| `/inventory` or `/inventory/*` | `inventory_health` |

The edge function already has system prompts for `crm_pipeline`, `pos_performance`, `production`, `hr_overview`, and `purchasing`. The sidebar just doesn't route to them.

**Fix**: Add these paths to the `contextMap` in `getNarrativeContext`.

---

## Issue 3: Hub Pages (SalesHub, PosHub, InventoryHub, PurchasingHub) Have No AI Integration

These hub/landing pages are pure navigation link grids with zero data or AI. They don't use:
- `AiModuleInsights` (live anomaly detection)
- `AiAnalyticsNarrative` (contextual analysis)

The CRM Dashboard (`CrmDashboard.tsx`) does have both. The other hubs should follow this pattern.

This is a design choice rather than a bug -- the hub pages are intentionally lightweight navigation menus. Adding data/AI would require fetching KPIs, which changes their purpose. I recommend leaving hubs as-is but ensuring the AI sidebar narrative works on all module sub-pages (Issue 2 above covers this).

---

## Issue 4: Quotes Page Has No AI Narrative

`Quotes.tsx` does not include `AiAnalyticsNarrative`. Since quotes are a leading sales indicator (conversion rates, average deal size, pipeline velocity), this is a missed opportunity. However, the sidebar AI narrative (Issue 2) would cover this if `/sales/*` is mapped to a context.

---

## What Is Already Well Connected

1. **Document Chain**: Quote → Sales Order → Dispatch Note → Invoice all pass `partner_id`, line items, and warehouse context via `navigate()` state. This chain is complete.

2. **GL Posting**: All 12 previously-hardcoded modules now use `postWithRuleOrFallback`. Invoices and POS use server-side RPCs (`process_invoice_post`, `create_journal_from_invoice`, `process_pos_sale`), which is the correct approach for these high-volume operations.

3. **Analytics**: All 15 analytics pages have `AiAnalyticsNarrative` with correct context types and data passed in.

4. **Edge Function**: The `ai-analytics-narrative` function supports all 21 context types with dedicated system prompts. It can query the database for additional context.

5. **Partner Model**: Quotes, Sales Orders, Invoices, Purchase Orders, and CRM all reference `partners` table. The unified partner model is correctly implemented.

---

## Implementation Plan

### Change 1: Fix CRM Dashboard contextType
- **File**: `src/pages/tenant/CrmDashboard.tsx`
- Change `contextType="planning"` to `contextType="crm_pipeline"` (line 225)

### Change 2: Expand AI Sidebar Context Map
- **File**: `src/components/ai/AiContextSidebar.tsx`
- Add missing path→context mappings to `getNarrativeContext`:
  - `/crm` → `crm_pipeline`
  - `/pos` → `pos_performance`
  - `/production` → `production`
  - `/hr` → `hr_overview`
  - `/purchasing` → `purchasing`
  - `/inventory` → `inventory_health`
  - `/sales` → `dashboard` (reuse general context; or we can skip this)
  - `/accounting/expenses` → `expenses`

### No Other Changes Needed
- GL posting is fully migrated (Phases 1-3 complete)
- Document chains are connected
- Analytics pages all have AI narratives
- Edge function supports all required context types




# Phase 2: Real-Time Data & Dashboards

## Overview

Three new dashboard features that replace static placeholders with live data from existing database tables.

---

## 1. Fiscal Receipt Status Widget

**New component**: `src/components/dashboard/FiscalReceiptStatusWidget.tsx`

A card for the tenant dashboard that queries `fiscal_receipts` grouped by status, showing:
- **Signed** count (receipts with a valid `receipt_number` not starting with `OFFLINE-`)
- **Offline** count (receipts where `receipt_number LIKE 'OFFLINE-%'`)
- **Failed** count (receipts where `verification_status = 'failed'` or retry_count >= max threshold)

Includes a "Retry Offline" button that invokes `fiscalize-retry-offline` (reusing the existing logic from `FiscalDevices.tsx`).

Uses a simple horizontal bar or three stat boxes with color coding (green/amber/red).

**Integration**: Added to `src/pages/tenant/Dashboard.tsx` below the Module Health Summary, gated behind `canAccess("pos")` or a fiscal module check.

---

## 2. Live Platform Monitoring (Super Admin)

**Rewrite**: `src/pages/super-admin/PlatformMonitoring.tsx`

Wire the three static cards to real data:

| Card | Data Source | Query |
|---|---|---|
| Active Sessions | `audit_log` | Count distinct `user_id` where `created_at > now() - 1 hour` |
| API Calls (24h) | `module_events` | Count rows where `created_at > now() - 24 hours` |
| Errors (24h) | `module_events` | Count rows where `status = 'failed'` AND `created_at > now() - 24 hours` |

**System Events table**: Replace the static "No events" text with a live table showing the 20 most recent `module_events` rows across all tenants (super admin has cross-tenant visibility), displaying: timestamp, tenant, event_type, status, error_message.

Add auto-refresh every 30 seconds using `refetchInterval` on the React Query hooks.

---

## 3. Module Health Summary Enhancement

**Update**: `src/components/dashboard/ModuleHealthSummary.tsx`

Add a row below record counts showing recent event activity per module:

- Query `module_events` for the current tenant, grouped by `source_module`, counting events in the last 24 hours and errors (status = 'failed')
- Display as a small badge or sub-line under each module: e.g., "12 events / 1 error"

This gives a quick pulse on module activity alongside the existing record counts.

---

## Technical Details

### Files Created
1. `src/components/dashboard/FiscalReceiptStatusWidget.tsx` -- New fiscal status card with retry button

### Files Modified
1. `src/pages/tenant/Dashboard.tsx` -- Import and render `FiscalReceiptStatusWidget`
2. `src/pages/super-admin/PlatformMonitoring.tsx` -- Replace static cards with live queries from `audit_log` and `module_events`
3. `src/components/dashboard/ModuleHealthSummary.tsx` -- Add event activity indicators per module
4. `src/i18n/translations.ts` -- Add translation keys for new labels

### No Database Changes Required
All data sources (`fiscal_receipts`, `audit_log`, `module_events`, `module_event_logs`) already exist with proper RLS policies. Super Admin queries use `is_super_admin()` for cross-tenant access; tenant queries are scoped by `tenant_id`.

### Query Patterns

**Fiscal Receipt Status** (tenant-scoped):
```typescript
// Signed
supabase.from("fiscal_receipts").select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId).not("receipt_number", "like", "OFFLINE-%");

// Offline
supabase.from("fiscal_receipts").select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId).like("receipt_number", "OFFLINE-%");
```

**Platform Monitoring** (super admin, cross-tenant):
```typescript
// Active sessions (last hour)
supabase.from("audit_log").select("user_id", { count: "exact", head: true })
  .gte("created_at", oneHourAgo);

// Events 24h
supabase.from("module_events").select("id", { count: "exact", head: true })
  .gte("created_at", twentyFourHoursAgo);

// Recent system events
supabase.from("module_events").select("*")
  .order("created_at", { ascending: false }).limit(20);
```

**Module Event Activity** (tenant-scoped):
```typescript
supabase.from("module_events").select("source_module, status")
  .eq("tenant_id", tenantId).gte("created_at", twentyFourHoursAgo);
// Then group client-side by source_module
```


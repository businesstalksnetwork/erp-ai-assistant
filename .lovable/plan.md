

# Event Bus System for Inter-Module Communication

## Overview

Create a database-backed event bus that allows modules to communicate asynchronously without direct table coupling. When something meaningful happens (e.g., invoice posted, order confirmed, production completed), the originating module emits an event. Other modules can subscribe and react via Edge Functions.

## Architecture

### 1. Database Layer

**New table: `module_events`**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to tenants)
- `event_type` (text) -- e.g., `invoice.posted`, `sales_order.confirmed`, `production.completed`
- `source_module` (text) -- e.g., `accounting`, `sales`, `production`, `pos`
- `entity_type` (text) -- e.g., `invoice`, `sales_order`, `production_order`
- `entity_id` (UUID) -- polymorphic reference to the source record
- `payload` (JSONB) -- event-specific data snapshot
- `status` (text) -- `pending`, `processing`, `completed`, `failed`
- `retry_count` (int, default 0)
- `max_retries` (int, default 3)
- `error_message` (text, nullable)
- `processed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

**New table: `module_event_subscriptions`**
- `id` (UUID, PK)
- `event_type` (text) -- pattern to match, e.g., `invoice.*` or `sales_order.confirmed`
- `handler_module` (text) -- which module handles this
- `handler_function` (text) -- Edge Function name to invoke
- `is_active` (boolean, default true)
- `created_at` (timestamptz)

**New table: `module_event_logs`**
- `id` (UUID, PK)
- `event_id` (UUID, FK to module_events)
- `subscription_id` (UUID, FK to module_event_subscriptions)
- `status` (text) -- `success`, `failed`
- `response` (JSONB, nullable)
- `error_message` (text, nullable)
- `executed_at` (timestamptz)

### 2. Trigger Layer

A PostgreSQL trigger on `module_events` INSERT that calls `pg_notify('module_event', ...)` with the event ID and type. This enables real-time listeners.

A helper function `emit_module_event(...)` that modules call to publish events cleanly:
```sql
SELECT emit_module_event(
  p_tenant_id, 'invoice.posted', 'accounting',
  'invoice', invoice_id, '{"invoice_number":"INV-001","total":1500}'::jsonb
);
```

### 3. Edge Function: `process-module-event`

A single Edge Function that:
1. Receives an event ID (called via webhook or Supabase realtime)
2. Looks up matching subscriptions for the event type
3. For each subscription, calls the corresponding handler Edge Function
4. Logs results to `module_event_logs`
5. Updates the event status to `completed` or `failed`
6. Handles retries on failure (up to `max_retries`)

### 4. Seed Subscriptions

Pre-configure default inter-module subscriptions:

| Event Type | Handler Module | Handler Function |
|---|---|---|
| `invoice.posted` | inventory | `process-module-event` (deduct stock) |
| `sales_order.confirmed` | inventory | `process-module-event` (reserve stock) |
| `production.completed` | inventory | `process-module-event` (add finished goods) |
| `pos.transaction_completed` | inventory | `process-module-event` (deduct stock) |
| `pos.transaction_completed` | accounting | `process-module-event` (create journal) |

### 5. Frontend: Event Monitor Page

A new admin page at `/settings/events` (or within existing Settings page) showing:
- Recent events with status badges (pending/completed/failed)
- Filter by module, event type, status
- Retry failed events manually
- View event payload and processing logs

## Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/..._event_bus.sql` | Tables, trigger, emit function, seed subscriptions |
| `supabase/functions/process-module-event/index.ts` | Event processor Edge Function |
| `src/pages/tenant/EventMonitor.tsx` | Admin UI for viewing/managing events |

## Files to Modify

| File | Changes |
|---|---|
| `src/App.tsx` | Add route for EventMonitor |
| `src/layouts/TenantLayout.tsx` | Add "Event Monitor" under Settings or a new System group |
| `src/i18n/translations.ts` | Add EN/SR keys for event bus labels |
| `supabase/config.toml` | Register `process-module-event` function |

## Technical Notes

- The event bus is **asynchronous** -- emitting an event does not block the original transaction
- `pg_notify` payload is limited to 8KB; we only send the event ID and type, then the Edge Function fetches full details
- Failed events can be retried manually from the UI or automatically (up to max_retries)
- Event subscriptions are tenant-agnostic (system-level config), but events themselves are tenant-scoped
- RLS on `module_events` ensures tenant isolation for the monitoring UI
- The `emit_module_event` function is `SECURITY DEFINER` so it can be called from existing triggers


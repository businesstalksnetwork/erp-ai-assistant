

# Complete WMS Integration: Routes, Navigation, and Edge Function

## What's Missing

The WMS database tables and frontend pages were created, but three critical pieces are missing:
1. **Routes in App.tsx** -- no WMS pages are importable or routable
2. **Navigation in TenantLayout.tsx** -- no WMS links in the sidebar
3. **Edge function** -- `wms-slotting` for AI analysis not yet created

## Changes

### 1. App.tsx -- Add Imports and Routes

Add 7 imports for the WMS pages:
- `WmsZones`, `WmsBinDetail`, `WmsTasks`, `WmsReceiving`, `WmsPicking`, `WmsCycleCounts`, `WmsSlotting`

Add 7 routes under the tenant layout (after existing inventory routes, before line 271):
```
inventory/wms/zones
inventory/wms/bins/:id
inventory/wms/tasks
inventory/wms/receiving
inventory/wms/picking
inventory/wms/cycle-counts
inventory/wms/slotting
```
All wrapped in `<ProtectedRoute requiredModule="inventory">`.

### 2. TenantLayout.tsx -- Add Nav Items

Add new icons to the lucide import: `ScanBarcode`, `MapPin`, `RefreshCw`, `Brain`

Add 6 entries to the `inventoryNav` array (after the existing 10 items):
- WMS Zones (`/inventory/wms/zones`, `MapPin`)
- WMS Tasks (`/inventory/wms/tasks`, `ClipboardCheck`)
- WMS Receiving (`/inventory/wms/receiving`, `Truck`)
- WMS Picking (`/inventory/wms/picking`, `ScanBarcode`)
- Cycle Counts (`/inventory/wms/cycle-counts`, `RefreshCw`)
- AI Slotting (`/inventory/wms/slotting`, `Brain`)

### 3. Edge Function: `supabase/functions/wms-slotting/index.ts`

Create the AI slotting edge function that:
- Accepts warehouse_id, tenant_id, and optimization parameters
- Queries pick history (last 90 days), bin attributes, current bin_stock
- Calculates SKU velocity scores and co-occurrence affinity
- Uses the AI model to generate placement recommendations
- Returns scored recommendations with reasons and estimated improvement

### 4. Translations

Add missing nav translation keys (`wmsZonesNav`, `wmsTasksNav`, `wmsReceivingNav`, `wmsPickingNav`, `wmsCycleCountsNav`, `wmsSlottingNav`) if needed, or reuse existing keys already added.

## Implementation Order

1. Update `App.tsx` (imports + routes)
2. Update `TenantLayout.tsx` (icons + nav items)
3. Create `wms-slotting` edge function
4. Add any missing translation keys


# Fiscalization Hardening: Configurable Tax Labels + Timeout Recovery

## Overview

Two changes to improve Serbian fiscalization compliance:
1. Replace hardcoded tax label mapping (20->A, 10->G, 0->E) with per-device configurable mapping stored in the database
2. Add timeout recovery using `GET /api/v3/invoices/{requestId}` when the initial POST times out

---

## Change 1: Configurable Tax Label Mapping

### Database Migration

Add a `tax_label_map` JSONB column to `fiscal_devices`:

```sql
ALTER TABLE fiscal_devices 
ADD COLUMN tax_label_map jsonb DEFAULT '{"20":"A","10":"G","0":"E"}'::jsonb;
```

The default value preserves current behavior. Each device can override it (e.g., a device with different VAT categories or farmer compensation rate 8%).

### Edge Function Changes (`fiscalize-receipt/index.ts`)

- Remove the hardcoded `TAX_LABEL_MAP` constant
- Read `device.tax_label_map` after loading the device config
- Build a resolved map: merge the device's custom map with a sensible fallback
- Use it in both the item label assignment and the tax grouping logic

### Frontend Changes (`FiscalDevices.tsx`)

- Add a "Tax Label Mapping" section to the add/edit device dialog
- Display as editable key-value rows (tax rate -> label) with ability to add/remove entries
- Pre-populate with the default mapping when creating a new device
- Store as JSON in the `tax_label_map` field

---

## Change 2: Timeout Recovery with GET Status Check

### Problem

Currently, if the POST to `/api/v3/invoices` times out (network issue, slow SDC), the function immediately marks the receipt as OFFLINE. But the SDC may have actually processed and signed the receipt -- creating a "ghost fiscal receipt" that the tax authority sees but the ERP does not.

### Solution

Add a unique `requestId` (UUID) to each fiscalization attempt, sent as a header. On timeout, perform a `GET /api/v3/invoices/{requestId}` status check before falling back to offline mode.

### Edge Function Changes (`fiscalize-receipt/index.ts`)

1. Generate a UUID `requestId` before the POST call
2. Add a 10-second timeout to the POST using `AbortSignal.timeout(10000)`
3. Include `RequestId` header in the POST
4. On timeout/error, attempt a GET status check:
   ```
   GET {device.api_url}/api/v3/invoices/{requestId}
   ```
5. If GET returns a valid response with `invoiceNumber`, use it (receipt was actually signed)
6. If GET also fails, then fall back to OFFLINE mode
7. Store `requestId` in the `fiscal_receipts` record for future retry correlation

### Database Migration

Add a `request_id` column to `fiscal_receipts`:

```sql
ALTER TABLE fiscal_receipts 
ADD COLUMN request_id uuid;
```

### Retry Function Update (`fiscalize-retry-offline/index.ts`)

- When retrying offline receipts, use the stored `request_id` 
- First try `GET /api/v3/invoices/{requestId}` to check if the original was actually processed
- Only re-POST if the GET confirms no prior processing

---

## Technical Details

### Files Modified

1. **New migration** -- Add `tax_label_map` to `fiscal_devices` and `request_id` to `fiscal_receipts`
2. **`supabase/functions/fiscalize-receipt/index.ts`** -- Configurable tax labels + requestId + timeout recovery
3. **`supabase/functions/fiscalize-retry-offline/index.ts`** -- Use stored requestId for GET-before-retry
4. **`src/pages/tenant/FiscalDevices.tsx`** -- Tax label mapping editor in device dialog

### Tax Label Map Editor UI

The device form dialog will include a section like:

```
Tax Label Mapping
+-----------+-------+--------+
| Tax Rate  | Label | Action |
+-----------+-------+--------+
| 20        | A     | [x]    |
| 10        | G     | [x]    |
| 0         | E     | [x]    |
+-----------+-------+--------+
[+ Add Row]
```

Users can add entries for special rates (e.g., 8% farmer compensation -> label "K") or adjust labels to match their specific SDC/LPFR configuration.

### Timeout Recovery Flow

```
Generate requestId (UUID)
    |
    v
POST /api/v3/invoices (with RequestId header, 10s timeout)
    |
    +---> Success: use response as normal
    |
    +---> Timeout/Network Error:
              |
              v
         GET /api/v3/invoices/{requestId} (5s timeout)
              |
              +---> Found (invoiceNumber present): receipt WAS signed, use it
              |
              +---> Not found / error: mark as OFFLINE, store requestId for later retry
```

### Retry-Offline Enhanced Flow

```
For each offline receipt with request_id:
    |
    v
GET /api/v3/invoices/{requestId} first
    |
    +---> Found: update receipt, done (no duplicate fiscal receipt)
    |
    +---> Not found: proceed with POST retry (as before)
```



# Location Types + Internal Orders + Warehouse Transfer Flow

## Overview

This plan builds a complete internal supply chain: configurable location types, internal ordering (store requests stock from central warehouse), internal transfers with otpremnica printing, and store-side goods receipt confirmation that only then moves stock into the store's sales inventory ("prodajni magacin").

---

## The Full Flow

```text
1. Store manager creates INTERNAL ORDER (Interna narudzbenica)
   -> Requests products from central warehouse

2. Warehouse confirms order, creates INTERNAL TRANSFER (Interni prenos)
   -> Picks items, generates internal otpremnica (dispatch note)
   -> Status: draft -> confirmed -> in_transit

3. Store receives shipment, opens INTERNAL GOODS RECEIPT (Interni prijem)
   -> Reviews items vs. what was sent
   -> Can note discrepancies (damaged, missing items)
   -> Confirms receipt

4. ONLY on confirmation: stock moves INTO store's "prodajni magacin"
   -> inventory_stock updated for store warehouse
   -> inventory_movements recorded
```

---

## Part 1: Configurable Location Types

### Database

New `location_types` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK | |
| name | text | e.g. "Kancelarija", "Magacin", "Prodavnica" |
| code | text | office, warehouse, shop, branch |
| has_warehouse | boolean | Shows warehouse link in location form |
| has_sellers | boolean | Shows seller assignment in location form |
| is_active | boolean | |

Seed defaults: Office, Magacin (has_warehouse=true), Shop (has_warehouse=true, has_sellers=true), Branch.

Add `location_type_id` FK to `locations` table (keep `type` text for backward compat).

### UI Changes (Locations.tsx)

- Fetch `location_types` dynamically instead of hardcoded array
- Add "Manage Types" button opening a CRUD dialog for location types
- When type `has_warehouse`: show warehouse dropdown
- When type `has_sellers`: show multi-select to assign salespeople to location
- Show connected warehouse name in the locations table

---

## Part 2: Internal Orders (Interna narudzbenica)

### Database

New `internal_orders` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| tenant_id | uuid FK |
| order_number | text |
| requesting_location_id | uuid FK locations |
| source_warehouse_id | uuid FK warehouses |
| status | text (draft, submitted, approved, fulfilled, cancelled) |
| notes | text |
| requested_by | uuid |
| approved_by | uuid |
| created_at, updated_at | timestamptz |

New `internal_order_items` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| internal_order_id | uuid FK |
| product_id | uuid FK |
| quantity_requested | numeric |
| quantity_approved | numeric |

### New Page: InternalOrders.tsx

- List of internal orders with status badges
- Create dialog: select requesting location (auto-suggests source warehouse), add product lines with quantities
- Submit action sends order to warehouse manager
- Approve action (warehouse side) can adjust quantities
- Fulfill action creates an internal transfer automatically

---

## Part 3: Internal Transfers (Interni prenos)

### Database

New `internal_transfers` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| tenant_id | uuid FK |
| transfer_number | text |
| internal_order_id | uuid FK (nullable) |
| from_warehouse_id | uuid FK |
| to_warehouse_id | uuid FK |
| status | text (draft, confirmed, in_transit, delivered, cancelled) |
| notes | text |
| created_by | uuid |
| confirmed_at, shipped_at, delivered_at | timestamptz |

New `internal_transfer_items` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| transfer_id | uuid FK |
| product_id | uuid FK |
| quantity_sent | numeric |
| quantity_received | numeric (filled on receipt) |

### RPC: confirm_internal_transfer

When transfer is confirmed (shipped):
- Creates "out" `inventory_movements` from source warehouse
- Reduces `inventory_stock` at source warehouse
- Status moves to `in_transit`
- Stock is NOT yet added to destination -- it's "in transit"

### New Page: InternalTransfers.tsx

- List with status flow (draft -> confirmed -> in_transit -> delivered)
- Create transfer (manually or auto-generated from internal order)
- Line items: product, quantity sent
- Print internal otpremnica button (uses existing `generate-pdf` edge function with new type: "internal_otpremnica")

### Internal Otpremnica PDF

Extend `generate-pdf` to support `type: "internal_otpremnica"`:
- Source warehouse name and address
- Destination location/warehouse name and address
- Line items table (product, SKU, quantity, unit)
- Transfer number, date, driver info
- Signature lines for sender and receiver

---

## Part 4: Internal Goods Receipt (Interni prijem robe)

### Database

New `internal_goods_receipts` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| tenant_id | uuid FK |
| receipt_number | text |
| internal_transfer_id | uuid FK |
| receiving_warehouse_id | uuid FK |
| status | text (pending, confirmed) |
| received_by | uuid |
| confirmed_at | timestamptz |
| notes | text |

New `internal_goods_receipt_items` table:

| Column | Type |
|--------|------|
| id | uuid PK |
| receipt_id | uuid FK |
| transfer_item_id | uuid FK |
| product_id | uuid FK |
| quantity_expected | numeric |
| quantity_received | numeric |
| discrepancy_notes | text |

### RPC: confirm_internal_receipt

This is the critical function -- ONLY when store confirms receipt:
1. Creates "in" `inventory_movements` for destination warehouse
2. Updates `inventory_stock` at destination (store's prodajni magacin)
3. Creates cost layers at destination warehouse
4. Updates the `internal_transfer` status to `delivered`
5. Records any discrepancies (short/damaged items)

### New Page: InternalGoodsReceipts.tsx

- Store-side view of incoming transfers
- Auto-created when transfer status is `in_transit` (or manually created)
- Shows expected items vs. what actually arrived
- Store fills in `quantity_received` for each line
- Can add discrepancy notes per item
- "Confirm Receipt" button triggers the RPC -- only then stock appears in store inventory

---

## Part 5: Warehouse Detail View

### New Page: WarehouseDetail.tsx

Route: `/inventory/warehouses/:id`

Tabs:
- **Products**: All `inventory_stock` for this warehouse (qty, value, min levels)
- **Movements**: `inventory_movements` filtered to this warehouse
- **Outgoing Transfers**: Internal transfers FROM this warehouse
- **Incoming Transfers**: Internal transfers TO this warehouse
- **Pending Orders**: Internal orders requesting from this warehouse

---

## Navigation Updates

Add to `inventoryNav` in TenantLayout.tsx:
- "Internal Orders" (Interne narudzbenice) - ClipboardCheck icon
- "Internal Transfers" (Interni prenosi) - Truck icon
- "Internal Receipts" (Interni prijem) - FileInput icon
- "Warehouses" link updated to be clickable to detail view

Add routes in App.tsx:
- `/inventory/internal-orders` -> InternalOrders
- `/inventory/internal-transfers` -> InternalTransfers
- `/inventory/internal-receipts` -> InternalGoodsReceipts
- `/inventory/warehouses/:id` -> WarehouseDetail

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| Migration SQL | location_types, internal_orders, internal_transfers, internal_goods_receipts tables + RPCs |
| `src/pages/tenant/InternalOrders.tsx` | Store orders from warehouse |
| `src/pages/tenant/InternalTransfers.tsx` | Warehouse-to-store transfers with otpremnica |
| `src/pages/tenant/InternalGoodsReceipts.tsx` | Store confirms received items |
| `src/pages/tenant/WarehouseDetail.tsx` | Per-warehouse products, movements, transfers |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/tenant/Locations.tsx` | Dynamic types from DB, manage types dialog, seller assignment |
| `src/layouts/TenantLayout.tsx` | Add internal orders/transfers/receipts to inventory nav |
| `src/App.tsx` | Add 4 new routes |
| `supabase/functions/generate-pdf/index.ts` | Add internal otpremnica PDF type |
| `src/i18n/translations.ts` | New keys for all new features |
| `src/pages/tenant/InventoryStock.tsx` | Make warehouse names clickable to detail page |


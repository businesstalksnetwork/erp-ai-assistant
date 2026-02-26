

# Plan: Assets Cross-Module Integration

This is a large integration effort connecting Assets to 5 existing modules. I'll break it into manageable implementation tasks.

## Current State

- `assets` table already has: `supplier_id`, `responsible_employee_id`, `location_id`, `cost_center_id`, `legal_entity_id`
- `asset_documents` table exists (file attachments)
- `documents` table has `entity_type` / `entity_id` (DMS linkage ready)
- `drive_files` / `drive_folders` exist with full versioning
- `purchase_orders` → `goods_receipts` → `supplier_invoices` chain exists
- AssetForm.tsx currently does NOT expose supplier, warehouse, PO, employee, or document fields

## Database Changes

**Migration: Add linking columns to `assets`**
```sql
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS goods_receipt_id uuid REFERENCES goods_receipts(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid REFERENCES supplier_invoices(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS drive_folder_id uuid REFERENCES drive_folders(id);
```

No new tables needed — we leverage existing `documents.entity_type='asset'` for DMS and `drive_folders` for Drive.

## Implementation Tasks

### Task 1: Expand AssetForm with Cross-Module Fields

Add new sections to `AssetForm.tsx`:

- **Nabavka (Purchasing)**: Dropdowns for `purchase_order_id`, `goods_receipt_id`, `supplier_invoice_id` (filtered by tenant). Show linked PO number, GR number, SI number.
- **Dobavljač (Supplier)**: Already has `supplier_id` in DB but not in form — add partner/supplier selector.
- **Magacin (Warehouse)**: Dropdown for `warehouse_id` (from `warehouses` table).
- **Proizvod (Product)**: Optional link to `product_id` (from `products` table) for inventory-tracked assets.
- **Zaposleni (HR)**: `responsible_employee_id` selector (already in DB, not in form).

### Task 2: Auto-Create Asset from Goods Receipt

In `GoodsReceipts.tsx` or the goods receipt detail flow, add a "Kreiraj sredstvo" (Create Asset) action button that:
- Pre-fills asset form with supplier, PO, warehouse, cost from the receipt line
- Sets `goods_receipt_id` and `purchase_order_id` on the new asset

### Task 3: DMS Integration — Register Asset Documents in Delovodnik

- When an asset is created/updated, auto-register key documents (revers, warranty, purchase contract) into the DMS `documents` table with `entity_type = 'asset'`, `entity_id = asset.id`.
- On `AssetForm.tsx` detail view, show a "Dokumenta" tab listing all DMS documents linked to this asset via `entity_type/entity_id`.
- Allow creating new DMS protocol entries directly from the asset detail.

### Task 4: Drive Integration — Asset File Folder

- On asset creation, auto-create a Drive folder at `/Imovina/{asset_code}/` using `drive_folders`.
- Store `drive_folder_id` on the asset record.
- On asset detail, show a "Fajlovi" tab with files from that Drive folder (warranty PDFs, photos, manuals).
- Upload widget that saves to the asset's Drive folder.

### Task 5: AssetRegistry Table Enhancement

Update `AssetRegistry.tsx` to show new columns:
- Supplier name (from `partners` via `supplier_id`)
- Warehouse (from `warehouses` via `warehouse_id`)
- Responsible employee (from `employees` via `responsible_employee_id`)
- PO number link
- Document count badge

### Task 6: HR Integration — Employee Dosije Link

- On `EmployeeDetail.tsx`, add an "Imovina" tab showing all assets where `responsible_employee_id = employee.id` or active assignments.
- Clicking an asset navigates to the asset detail.

### Task 7: Accounting Integration — Journal Entry Links

- On asset detail, show a "Knjiženja" tab listing all journal entries linked to this asset (depreciation, disposal, revaluation).
- Link from journal entries back to the asset.

## Affected Files

**Database**: 1 migration (add FK columns)

**Modified pages**:
- `AssetForm.tsx` — add 6 new form sections
- `AssetRegistry.tsx` — expand table columns and joins
- `GoodsReceipts.tsx` — add "Create Asset" action
- `EmployeeDetail.tsx` — add "Imovina" tab

**New components** (minimal):
- Asset DMS tab component
- Asset Drive tab component  
- Asset journal entries tab component

**Translations**: ~20 new keys


# Inventory / WMS Module

## Pages (Routes) — ~25 pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/inventory` | InventoryHub | Module dashboard |
| `/inventory/products` | Products | Product catalog |
| `/inventory/products/new` | ProductForm | Create product |
| `/inventory/products/:id` | ProductForm | Edit product |
| `/inventory/stock` | InventoryStock | Stock levels by warehouse |
| `/inventory/warehouses` | Warehouses | Warehouse management |
| `/inventory/stock-movements` | StockMovements | Stock movement history |
| `/inventory/goods-receipts` | GoodsReceipts | Purchase goods receipts |
| `/inventory/internal-receipts` | InternalGoodsReceipts | Internal transfer receipts |
| `/inventory/purchase-orders` | PurchaseOrders | Purchase order management |
| `/inventory/purchase-orders/new` | PurchaseOrderForm | Create PO |
| `/inventory/purchase-orders/:id` | PurchaseOrderForm | Edit PO |
| `/inventory/supplier-invoices` | SupplierInvoices | Supplier invoice management |
| `/inventory/production` | ProductionOrders | Production order list |
| `/inventory/production/new` | ProductionOrderForm | Create production order |
| `/inventory/bom` | BomTemplates | Bill of Materials templates |
| `/inventory/returns` | Returns | Customer returns |
| `/inventory/kalkulacija` | Kalkulacija | Cost calculation (markup) |
| `/inventory/nivelacija` | Nivelacija | Price level adjustment |
| `/inventory/categories` | ProductCategories | Product category tree |
| `/inventory/wms/receipts` | WmsReceipts | WMS receipt management |
| `/inventory/wms/put-away` | WmsPutAway | WMS put-away tasks |
| `/inventory/wms/picking` | WmsPicking | WMS pick lists |
| `/inventory/wms/locations` | WmsLocations | WMS location management |
| `/inventory/documents` | InventoryDocuments | Inventory document archive |

## Database Tables

### Core Inventory
| Table | Key Columns |
|-------|------------|
| `products` | id, tenant_id, name, sku, barcode, unit, category_id, purchase_price, selling_price, tax_rate |
| `product_categories` | id, tenant_id, name, parent_id |
| `inventory_stock` | id, tenant_id, product_id, warehouse_id, quantity_on_hand, reserved_quantity |
| `warehouses` | id, tenant_id, name, code, address, is_active |
| `stock_movements` | id, tenant_id, product_id, warehouse_id, quantity, movement_type, reference_id |

### Purchasing
| Table | Key Columns |
|-------|------------|
| `purchase_orders` | id, tenant_id, partner_id, order_date, status, total |
| `purchase_order_lines` | id, purchase_order_id, product_id, quantity, unit_price |
| `goods_receipts` | id, tenant_id, purchase_order_id, warehouse_id, receipt_date, status |
| `goods_receipt_lines` | id, goods_receipt_id, product_id, quantity_received |
| `supplier_invoices` | id, tenant_id, partner_id, invoice_number, total, status, journal_entry_id |
| `supplier_invoice_lines` | id, supplier_invoice_id, product_id, quantity, unit_price, tax_rate |

### Production
| Table | Key Columns |
|-------|------------|
| `production_orders` | id, tenant_id, product_id, planned_quantity, status, planned_start, planned_end |
| `production_order_lines` | id, production_order_id, material_product_id, planned_quantity, actual_quantity |
| `bom_templates` | id, tenant_id, product_id, name, version, is_active |
| `bom_lines` | id, bom_template_id, material_product_id, quantity, unit |

### WMS
| Table | Key Columns |
|-------|------------|
| `wms_receipts` | id, tenant_id, warehouse_id, status, received_at |
| `wms_receipt_lines` | id, receipt_id, product_id, quantity, location_id |
| `wms_locations` | id, warehouse_id, zone, aisle, rack, shelf |
| `wms_pick_lists` | id, tenant_id, sales_order_id, status |
| `wms_pick_list_lines` | id, pick_list_id, product_id, quantity, location_id |

## RPC Functions

| RPC | Called By | Purpose |
|-----|----------|---------|
| `adjust_inventory_stock` | `GoodsReceipts.tsx`, `InventoryStock.tsx`, `Returns.tsx`, `process_invoice_post` | Adjust stock quantity (+ or -) |
| `complete_production_order` | `ProductionOrders.tsx` | Consume materials + produce finished goods |
| `confirm_internal_receipt` | `InternalGoodsReceipts.tsx` | Confirm internal transfer receipt |

## GL Posting Touchpoints

| Source | File | Method | GL Codes |
|--------|------|--------|----------|
| Supplier Invoice | `SupplierInvoices.tsx` | `createCodeBasedJournalEntry` | 5xxx (expense) / 2100 (AP) |
| Kalkulacija | `Kalkulacija.tsx` | `createCodeBasedJournalEntry` | Cost markup adjustment entries |
| Nivelacija | `Nivelacija.tsx` | `createCodeBasedJournalEntry` | Price level adjustment entries |
| Sales Invoice Post | `Invoices.tsx` | `process_invoice_post` RPC | Server-side: adjusts stock AND creates journal |
| Production Complete | `ProductionOrders.tsx` | `complete_production_order` RPC | Adjusts stock only (no direct GL yet) |
| Goods Receipt | `GoodsReceipts.tsx` | `adjust_inventory_stock` RPC | Stock adjustment only (GL via supplier invoice) |
| Returns | `Returns.tsx` | `adjust_inventory_stock` RPC | Stock adjustment (restock) |

## Cross-Module Dependencies

### Reads From
- **Partners** (`partners`): supplier on POs, goods receipts, supplier invoices
- **Accounting**: `chart_of_accounts` for GL posting (supplier invoices)
- **Sales**: `sales_orders` linked to pick lists

### Writes To
- **Accounting**: `journal_entries` via supplier invoice posting, kalkulacija, nivelacija
- **Accounting**: `process_invoice_post` adjusts `inventory_stock` when posting sales invoices
- **Stock**: `inventory_stock.quantity_on_hand` modified by receipts, production, returns

## Known Gaps
- Production order completion adjusts stock but does NOT create GL journal entries (WIP → FG accounting missing)
- Goods receipt does NOT create GL entry — GL happens later via supplier invoice posting
- Kalkulacija/Nivelacija GL codes are hardcoded — not on posting rules engine
- No automated COGS journal creation when sales invoice is posted

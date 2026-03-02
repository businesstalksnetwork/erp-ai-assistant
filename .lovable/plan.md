

# Phase 3 Status: Complete

All 4 features (R1-R4) are implemented:
- R1: Promotions engine (DB + UI)
- R2: AI Market Basket Analysis (edge function + UI)
- R3: Gift Card Management (DB + UI)
- R4: Loyalty Analytics with RFM/CLV (UI)

R5-R8 (multi-location sync, customer display, table service, e-commerce sync) are P2/P3 and can be deferred.

---

# Phase 4: Purchasing/Inventory 4.75 → 5.0

## 8 Features (I1-I8)

### 4A. I1 — AI Ordering Prediction per Supplier (P0 Flagship)
**DB migration**: Create `supplier_order_predictions` and `supplier_lead_times` tables with RLS policies (tenant-scoped). Add indexes on `(tenant_id, supplier_id)` and `(tenant_id, product_id)`.

**Edge function** `ai-ordering-prediction`:
- Input: `{ tenant_id, supplier_id?, horizon_days: 30 }`
- Fetches products linked to supplier via `purchase_order_lines` JOIN `purchase_orders`
- For each product: pulls 24 months of `invoice_lines` + `pos_transactions` sales, applies `seasonalDecompose()` (reuse algorithm from `DemandForecasting.tsx`), fetches avg lead time from `supplier_lead_times`, calculates EOQ/reorder point/safety stock
- Compares current `inventory_stock` to reorder point; generates predictions for products at or below threshold
- Stores in `supplier_order_predictions`, returns sorted by urgency
- Includes rate limiting (10 req/min) and audit logging

**UI page** `SupplierOrderPredictions.tsx`:
- Supplier dropdown filter
- Table: Product, Current Stock, Avg Daily Demand, Lead Time, Reorder Point, Recommended Qty, Order By Date, Confidence, Action
- KPI cards: Total predictions, Avg confidence, Estimated value, Urgent orders
- "Create PO" button converts prediction to purchase order
- Demand vs stock timeline chart (Recharts)

### 4B. I2 — Auto PO Generation from Predictions
Add a "Generate PO" mutation in `SupplierOrderPredictions.tsx` that:
- Groups accepted predictions by supplier
- Creates a `purchase_orders` row with `purchase_order_lines` from predictions
- Updates prediction status to `converted_to_po` with linked `purchase_order_id`
- Navigates to the new PO for review

### 4C. I3 — Supplier Lead Time Tracking
The `supplier_lead_times` table (created in 4A) stores historical lead times with computed `lead_time_days` and `on_time` columns. Add a component `SupplierLeadTimeHistory.tsx` embedded in the supplier evaluation page showing:
- Average/median lead time per supplier
- On-time delivery rate
- Trend chart
- Auto-populate from goods receipts: when a receipt is confirmed, insert a lead time record linking PO ordered_date to receipt_date

### 4D. I4 — ABC/XYZ Inventory Classification
Create an edge function `inventory-classification` that:
- Fetches all products with sales data for the tenant
- Calculates annual revenue per product (ABC by value: A=top 80%, B=next 15%, C=bottom 5%)
- Calculates demand variability coefficient of variation (XYZ: X=CV<0.5, Y=0.5-1.0, Z=>1.0)
- Returns a 3x3 matrix with product counts and recommendations

Create `InventoryClassification.tsx` page with matrix heatmap, product table with class assignments, and strategy recommendations per class.

### 4E. I5 — Framework/Blanket Agreement Management
**DB migration**: Create `blanket_agreements` table (tenant_id, supplier_id, agreement_number, start/end dates, total_value, consumed_value, status) and `blanket_agreement_lines` (product_id, agreed_qty, agreed_price, consumed_qty).

**UI page** `BlanketAgreements.tsx`: CRUD for agreements with line items, consumption tracking, and alerts when nearing expiry or quantity limits.

### 4F. I6 — Multi-currency Purchase Pricing (P3, lightweight)
Add `currency` and `exchange_rate` fields to the purchase order form. Display converted amounts in tenant's base currency. No new tables needed — use existing `purchase_orders.currency` column if present, or add via migration.

### 4G. I7 — Consignment Inventory
**DB migration**: Create `consignment_stock` table (tenant_id, supplier_id, product_id, warehouse_id, quantity, status). Add RLS.

**UI page** `ConsignmentInventory.tsx`: View supplier-owned stock, convert to owned stock on sale/consumption, track consignment movements.

### 4H. I8 — Supplier Portal (P3, deferred)
This is a separate module requiring its own auth flow. Mark as deferred — can be implemented as a standalone feature in a later phase.

---

## Routing & Navigation
- Register new routes: `/purchasing/order-predictions`, `/purchasing/blanket-agreements`, `/purchasing/consignment`, `/analytics/inventory-classification`
- Add nav items under Purchasing and Analytics sections in `TenantLayout.tsx`

## Summary

| Item | Type | Files |
|------|------|-------|
| 4A | Migration + Edge Function + Page | New migration, `ai-ordering-prediction/index.ts`, `SupplierOrderPredictions.tsx` |
| 4B | Frontend enhancement | `SupplierOrderPredictions.tsx` (PO creation logic) |
| 4C | Component + GoodsReceipts hook | `SupplierLeadTimeHistory.tsx`, `GoodsReceipts.tsx` edit |
| 4D | Edge Function + Page | `inventory-classification/index.ts`, `InventoryClassification.tsx` |
| 4E | Migration + Page | New migration, `BlanketAgreements.tsx` |
| 4F | Enhancement | `PurchaseOrders.tsx` edit, possible migration |
| 4G | Migration + Page | New migration, `ConsignmentInventory.tsx` |
| 4H | Deferred | — |


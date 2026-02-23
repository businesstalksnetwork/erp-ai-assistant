
-- Sales Orders: add legal_entity_id, warehouse_id
ALTER TABLE sales_orders 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Purchase Orders: add legal_entity_id, warehouse_id
ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Goods Receipts: add legal_entity_id, supplier_id
ALTER TABLE goods_receipts 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES partners(id);

-- Production Orders: add warehouse_id
ALTER TABLE production_orders 
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Invoices: add sales_order_id
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES sales_orders(id);

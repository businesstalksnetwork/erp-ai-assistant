
-- ============================================
-- Part 1: Location Types
-- ============================================
CREATE TABLE public.location_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  has_warehouse boolean NOT NULL DEFAULT false,
  has_sellers boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view location_types"
  ON public.location_types FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage location_types"
  ON public.location_types FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- Add location_type_id to locations
ALTER TABLE public.locations ADD COLUMN location_type_id uuid REFERENCES public.location_types(id);

-- ============================================
-- Part 2: Internal Orders
-- ============================================
CREATE TABLE public.internal_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  requesting_location_id uuid REFERENCES public.locations(id),
  source_warehouse_id uuid REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  requested_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_orders"
  ON public.internal_orders FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.internal_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_order_id uuid NOT NULL REFERENCES public.internal_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_requested numeric NOT NULL DEFAULT 0,
  quantity_approved numeric
);

ALTER TABLE public.internal_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_order_items"
  ON public.internal_order_items FOR ALL
  USING (internal_order_id IN (SELECT id FROM public.internal_orders WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

-- ============================================
-- Part 3: Internal Transfers
-- ============================================
CREATE TABLE public.internal_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  internal_order_id uuid REFERENCES public.internal_orders(id),
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_transfers"
  ON public.internal_transfers FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.internal_transfer_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id uuid NOT NULL REFERENCES public.internal_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_sent numeric NOT NULL DEFAULT 0,
  quantity_received numeric
);

ALTER TABLE public.internal_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_transfer_items"
  ON public.internal_transfer_items FOR ALL
  USING (transfer_id IN (SELECT id FROM public.internal_transfers WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

-- ============================================
-- Part 4: Internal Goods Receipts
-- ============================================
CREATE TABLE public.internal_goods_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  internal_transfer_id uuid NOT NULL REFERENCES public.internal_transfers(id),
  receiving_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'pending',
  received_by uuid,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_goods_receipts"
  ON public.internal_goods_receipts FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.internal_goods_receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES public.internal_goods_receipts(id) ON DELETE CASCADE,
  transfer_item_id uuid REFERENCES public.internal_transfer_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_expected numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  discrepancy_notes text
);

ALTER TABLE public.internal_goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage internal_goods_receipt_items"
  ON public.internal_goods_receipt_items FOR ALL
  USING (receipt_id IN (SELECT id FROM public.internal_goods_receipts WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

-- ============================================
-- RPC: Confirm Internal Transfer (ship out)
-- ============================================
CREATE OR REPLACE FUNCTION public.confirm_internal_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer internal_transfers%ROWTYPE;
  v_item RECORD;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  SELECT * INTO v_transfer FROM internal_transfers WHERE id = p_transfer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status != 'draft' AND v_transfer.status != 'confirmed' THEN
    RAISE EXCEPTION 'Transfer must be in draft or confirmed status';
  END IF;

  -- Process each item: deduct from source warehouse
  FOR v_item IN SELECT * FROM internal_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    -- Create outbound movement
    INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reference, notes, created_by)
    VALUES (v_transfer.tenant_id, v_item.product_id, v_transfer.from_warehouse_id, 'out', v_item.quantity_sent,
            'IT-' || v_transfer.transfer_number, 'Internal transfer out', v_user_id);
    
    -- Update stock at source
    UPDATE inventory_stock
    SET quantity_on_hand = quantity_on_hand - v_item.quantity_sent, updated_at = now()
    WHERE tenant_id = v_transfer.tenant_id AND product_id = v_item.product_id AND warehouse_id = v_transfer.from_warehouse_id;
  END LOOP;

  -- Update transfer status
  UPDATE internal_transfers
  SET status = 'in_transit', shipped_at = now(), confirmed_at = COALESCE(confirmed_at, now()), updated_at = now()
  WHERE id = p_transfer_id;
END;
$$;

-- ============================================
-- RPC: Confirm Internal Receipt
-- ============================================
CREATE OR REPLACE FUNCTION public.confirm_internal_receipt(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt internal_goods_receipts%ROWTYPE;
  v_transfer internal_transfers%ROWTYPE;
  v_item RECORD;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  SELECT * INTO v_receipt FROM internal_goods_receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF v_receipt.status != 'pending' THEN RAISE EXCEPTION 'Receipt already confirmed'; END IF;

  SELECT * INTO v_transfer FROM internal_transfers WHERE id = v_receipt.internal_transfer_id;

  -- Process each item: add to destination warehouse
  FOR v_item IN SELECT * FROM internal_goods_receipt_items WHERE receipt_id = p_receipt_id
  LOOP
    -- Create inbound movement
    INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reference, notes, created_by)
    VALUES (v_transfer.tenant_id, v_item.product_id, v_receipt.receiving_warehouse_id, 'in', v_item.quantity_received,
            'IR-' || v_receipt.receipt_number, 'Internal receipt', v_user_id);
    
    -- Upsert stock at destination
    INSERT INTO inventory_stock (tenant_id, product_id, warehouse_id, quantity_on_hand)
    VALUES (v_transfer.tenant_id, v_item.product_id, v_receipt.receiving_warehouse_id, v_item.quantity_received)
    ON CONFLICT (tenant_id, product_id, warehouse_id)
    DO UPDATE SET quantity_on_hand = inventory_stock.quantity_on_hand + EXCLUDED.quantity_on_hand, updated_at = now();

    -- Update transfer item received quantity
    IF v_item.transfer_item_id IS NOT NULL THEN
      UPDATE internal_transfer_items SET quantity_received = v_item.quantity_received WHERE id = v_item.transfer_item_id;
    END IF;
  END LOOP;

  -- Mark receipt as confirmed
  UPDATE internal_goods_receipts
  SET status = 'confirmed', confirmed_at = now(), received_by = v_user_id
  WHERE id = p_receipt_id;

  -- Mark transfer as delivered
  UPDATE internal_transfers
  SET status = 'delivered', delivered_at = now(), updated_at = now()
  WHERE id = v_receipt.internal_transfer_id;
END;
$$;


-- 3.8: Seed payment model codes for new transaction types
INSERT INTO public.payment_models (code, name_en, name_sr, direction, affects_bank, requires_invoice, allows_partial, is_system, description)
VALUES
  ('STOCK_TAKE_SHORTAGE', 'Stock Take Shortage', 'Manjak na popisu', 'INTERNAL', false, false, false, true, 'GL posting for inventory shortage found during stock take'),
  ('STOCK_TAKE_SURPLUS', 'Stock Take Surplus', 'Višak na popisu', 'INTERNAL', false, false, false, true, 'GL posting for inventory surplus found during stock take'),
  ('INVENTORY_WRITE_OFF', 'Inventory Write-Off', 'Otpis robe', 'INTERNAL', false, false, false, true, 'GL posting for inventory write-off/disposal'),
  ('SEVERANCE_PAYMENT', 'Severance Payment', 'Otpremnina', 'INTERNAL', false, false, false, true, 'GL posting for employee severance'),
  ('DEBIT_NOTE_ISSUED', 'Debit Note Issued', 'Knjižno zaduženje', 'OUT', false, true, false, true, 'GL posting for issued debit note')
ON CONFLICT (code) DO NOTHING;

-- 3.3: Atomic batch inventory adjustment RPC
CREATE OR REPLACE FUNCTION public.batch_adjust_inventory_stock(
  p_tenant_id uuid,
  p_adjustments jsonb,
  p_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adj jsonb;
BEGIN
  FOR adj IN SELECT * FROM jsonb_array_elements(p_adjustments)
  LOOP
    PERFORM adjust_inventory_stock(
      p_tenant_id := p_tenant_id,
      p_product_id := (adj->>'product_id')::uuid,
      p_warehouse_id := (adj->>'warehouse_id')::uuid,
      p_quantity := (adj->>'quantity')::numeric,
      p_movement_type := COALESCE(adj->>'movement_type', 'in'),
      p_reference := COALESCE(adj->>'reference', p_reference),
      p_notes := adj->>'notes',
      p_created_by := (adj->>'created_by')::uuid
    );
  END LOOP;
END;
$$;

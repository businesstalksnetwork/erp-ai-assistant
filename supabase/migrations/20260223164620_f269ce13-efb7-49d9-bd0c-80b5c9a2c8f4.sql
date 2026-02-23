
-- ══════════════════════════════════════════════
-- Tier 2: e-Otpremnice DB schema + min wage
-- ══════════════════════════════════════════════

-- 1. Dispatch Notes (Otpremnice)
CREATE TABLE public.dispatch_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  document_number text NOT NULL,
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  dispatch_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'sent', 'accepted', 'rejected', 'cancelled')),
  -- Sender info
  sender_pib text,
  sender_name text,
  sender_address text,
  sender_city text,
  -- Receiver info
  receiver_pib text,
  receiver_name text,
  receiver_address text,
  receiver_city text,
  -- Transport info
  vehicle_plate text,
  driver_name text,
  transport_reason text,
  -- Links
  sales_order_id uuid REFERENCES public.sales_orders(id),
  internal_transfer_id uuid REFERENCES public.internal_transfers(id),
  invoice_id uuid REFERENCES public.invoices(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  -- e-Otpremnica integration
  eotpremnica_id text, -- ID from eotpremnica.mfin.gov.rs
  eotpremnica_status text DEFAULT 'not_sent',
  eotpremnica_sent_at timestamptz,
  eotpremnica_response jsonb,
  -- Metadata
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dispatch notes for their tenant"
  ON public.dispatch_notes FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert dispatch notes for their tenant"
  ON public.dispatch_notes FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update dispatch notes for their tenant"
  ON public.dispatch_notes FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete draft dispatch notes"
  ON public.dispatch_notes FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND status = 'draft');

CREATE TRIGGER update_dispatch_notes_updated_at
  BEFORE UPDATE ON public.dispatch_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Dispatch Note Lines
CREATE TABLE public.dispatch_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_note_id uuid NOT NULL REFERENCES public.dispatch_notes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'kom',
  lot_number text,
  serial_number text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_note_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatch note lines follow parent access"
  ON public.dispatch_note_lines FOR ALL
  USING (dispatch_note_id IN (SELECT id FROM public.dispatch_notes WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));

-- 3. Dispatch Receipts (Prijemnice)
CREATE TABLE public.dispatch_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  dispatch_note_id uuid NOT NULL REFERENCES public.dispatch_notes(id),
  receipt_number text NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'partial')),
  received_by uuid,
  notes text,
  warehouse_id uuid REFERENCES public.warehouses(id),
  goods_receipt_id uuid REFERENCES public.goods_receipts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dispatch receipts for their tenant"
  ON public.dispatch_receipts FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert dispatch receipts for their tenant"
  ON public.dispatch_receipts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update dispatch receipts for their tenant"
  ON public.dispatch_receipts FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TRIGGER update_dispatch_receipts_updated_at
  BEFORE UPDATE ON public.dispatch_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add minimum_hourly_wage to payroll_parameters
ALTER TABLE public.payroll_parameters
  ADD COLUMN IF NOT EXISTS minimum_hourly_wage numeric DEFAULT 0;

-- Update existing 2026 parameters with min wage 371 RSD/hr
UPDATE public.payroll_parameters
  SET minimum_hourly_wage = 371
  WHERE effective_from = '2026-01-01' AND minimum_hourly_wage = 0;

-- 5. Indexes for performance
CREATE INDEX idx_dispatch_notes_tenant ON public.dispatch_notes(tenant_id);
CREATE INDEX idx_dispatch_notes_status ON public.dispatch_notes(tenant_id, status);
CREATE INDEX idx_dispatch_receipts_tenant ON public.dispatch_receipts(tenant_id);
CREATE INDEX idx_dispatch_receipts_note ON public.dispatch_receipts(dispatch_note_id);

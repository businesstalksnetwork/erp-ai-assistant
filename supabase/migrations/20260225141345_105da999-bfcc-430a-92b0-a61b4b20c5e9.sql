
-- Phase D: Journal entry attachments, report snapshots, transfer pricing

-- 1. Journal entry document attachments
CREATE TABLE public.journal_entry_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entry_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view JE attachments" ON public.journal_entry_attachments FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can insert JE attachments" ON public.journal_entry_attachments FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can delete JE attachments" ON public.journal_entry_attachments FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_je_attachments_entry ON public.journal_entry_attachments(journal_entry_id);

-- 2. Report snapshots (frozen versions of financial reports)
CREATE TABLE public.report_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  report_type TEXT NOT NULL, -- 'balance_sheet', 'income_statement', 'trial_balance', 'statisticki_aneks'
  report_title TEXT NOT NULL,
  period_from DATE,
  period_to DATE,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  frozen_by UUID,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view report snapshots" ON public.report_snapshots FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can insert report snapshots" ON public.report_snapshots FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_report_snapshots_tenant ON public.report_snapshots(tenant_id, report_type);

-- 3. Transfer pricing - related party transactions
CREATE TABLE public.transfer_pricing_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  relationship_type TEXT NOT NULL DEFAULT 'affiliate', -- affiliate, subsidiary, parent, shareholder
  ownership_pct NUMERIC(5,2),
  country_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transfer_pricing_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage TP parties" ON public.transfer_pricing_parties FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.transfer_pricing_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  party_id UUID NOT NULL REFERENCES public.transfer_pricing_parties(id),
  transaction_type TEXT NOT NULL, -- 'sale_goods', 'purchase_goods', 'service_rendered', 'service_received', 'loan_given', 'loan_received', 'royalty'
  description TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'RSD',
  arm_length_amount NUMERIC(18,2),
  method TEXT, -- 'CUP', 'RPM', 'CPM', 'TNMM', 'PSM'
  fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transfer_pricing_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage TP transactions" ON public.transfer_pricing_transactions FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_tp_txns_tenant_year ON public.transfer_pricing_transactions(tenant_id, fiscal_year);

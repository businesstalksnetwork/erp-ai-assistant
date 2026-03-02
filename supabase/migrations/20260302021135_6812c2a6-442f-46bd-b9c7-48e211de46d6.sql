
-- Phase 2: Compliance tables

-- QM-03: CAPA Workflow
CREATE TABLE public.capa_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'incident',
  source_id uuid,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  root_cause text,
  corrective_action text,
  preventive_action text,
  target_date date,
  completed_date date,
  verified_by uuid,
  verified_date date,
  verification_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capa_status_check CHECK (status IN ('open','in_progress','implemented','verification_pending','verified','closed')),
  CONSTRAINT capa_severity_check CHECK (severity IN ('low','medium','high','critical'))
);

ALTER TABLE public.capa_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for capa_actions" ON public.capa_actions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE INDEX idx_capa_actions_tenant ON public.capa_actions(tenant_id);
CREATE INDEX idx_capa_actions_status ON public.capa_actions(tenant_id, status);
CREATE TRIGGER update_capa_actions_updated_at BEFORE UPDATE ON public.capa_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRIV-03: DSAR Automation
CREATE TABLE public.dsar_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  request_type text NOT NULL DEFAULT 'access',
  subject_name text NOT NULL,
  subject_email text,
  subject_id_verified boolean NOT NULL DEFAULT false,
  description text,
  status text NOT NULL DEFAULT 'received',
  received_date timestamptz NOT NULL DEFAULT now(),
  deadline_date timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_date timestamptz,
  response_notes text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dsar_type_check CHECK (request_type IN ('access','rectification','erasure','restriction','portability','objection')),
  CONSTRAINT dsar_status_check CHECK (status IN ('received','identity_verification','in_progress','completed','rejected'))
);

ALTER TABLE public.dsar_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for dsar_requests" ON public.dsar_requests FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE INDEX idx_dsar_requests_tenant ON public.dsar_requests(tenant_id);
CREATE INDEX idx_dsar_requests_status ON public.dsar_requests(tenant_id, status);
CREATE INDEX idx_dsar_requests_deadline ON public.dsar_requests(deadline_date) WHERE status NOT IN ('completed','rejected');
CREATE TRIGGER update_dsar_requests_updated_at BEFORE UPDATE ON public.dsar_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI-05: Model Cards & Bias Testing
CREATE TABLE public.ai_model_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  model_name text NOT NULL,
  purpose text NOT NULL,
  input_description text,
  output_description text,
  limitations text,
  ethical_considerations text,
  performance_metrics jsonb DEFAULT '{}',
  training_data_description text,
  bias_risk_level text DEFAULT 'low',
  last_review_date date,
  next_review_date date,
  reviewed_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_bias_risk_check CHECK (bias_risk_level IN ('low','medium','high'))
);

ALTER TABLE public.ai_model_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI model cards readable by authenticated" ON public.ai_model_cards FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "AI model cards insertable by admin" ON public.ai_model_cards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "AI model cards updatable by admin" ON public.ai_model_cards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "AI model cards deletable by admin" ON public.ai_model_cards FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE INDEX idx_ai_model_cards_function ON public.ai_model_cards(function_name);
CREATE TRIGGER update_ai_model_cards_updated_at BEFORE UPDATE ON public.ai_model_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_bias_test_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_card_id uuid NOT NULL REFERENCES public.ai_model_cards(id) ON DELETE CASCADE,
  test_date timestamptz NOT NULL DEFAULT now(),
  test_type text NOT NULL,
  test_description text,
  result text NOT NULL,
  metrics jsonb DEFAULT '{}',
  passed boolean NOT NULL DEFAULT true,
  tested_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_bias_test_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bias test log readable by authenticated" ON public.ai_bias_test_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Bias test log insertable by admin" ON public.ai_bias_test_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE INDEX idx_ai_bias_test_log_card ON public.ai_bias_test_log(model_card_id);

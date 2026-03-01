
-- =============================================
-- Phase B: All migrations in one batch
-- =============================================

-- 1. POS-2: Split/Mixed Payments
CREATE TABLE public.pos_transaction_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_transaction_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pos_transaction_payments"
  ON public.pos_transaction_payments FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_pos_tx_payments_tx ON pos_transaction_payments(transaction_id);

-- 2. BANK-2: Partial Payment Matching (many-to-many bank line ↔ invoice)
CREATE TABLE public.bank_statement_line_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  bank_statement_line_id UUID NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  supplier_invoice_id UUID REFERENCES supplier_invoices(id),
  matched_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  match_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT chk_one_invoice CHECK (
    (invoice_id IS NOT NULL AND supplier_invoice_id IS NULL) OR
    (invoice_id IS NULL AND supplier_invoice_id IS NOT NULL)
  )
);

ALTER TABLE public.bank_statement_line_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for bank_statement_line_matches"
  ON public.bank_statement_line_matches FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_bslm_line ON bank_statement_line_matches(bank_statement_line_id);
CREATE INDEX idx_bslm_invoice ON bank_statement_line_matches(invoice_id);
CREATE INDEX idx_bslm_supplier ON bank_statement_line_matches(supplier_invoice_id);

-- 3. DMS-2: Document Templates
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for document_templates"
  ON public.document_templates FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.document_template_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for document_template_versions"
  ON public.document_template_versions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 4. DMS-3: Document Approval Workflow linking
CREATE TABLE public.document_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by UUID,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for document_workflows"
  ON public.document_workflows FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_doc_workflows_doc ON document_workflows(document_id);

CREATE TABLE public.document_approval_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL,
  action TEXT NOT NULL DEFAULT 'pending',
  comment TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for document_approval_steps"
  ON public.document_approval_steps FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 5. DMS-4+5: Full-Text Search on documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ocr_text TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING GIN(search_vector);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION public.documents_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.subject, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.notes, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.ocr_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF name, subject, notes, ocr_text
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.documents_search_vector_update();

-- Search RPC
CREATE OR REPLACE FUNCTION public.search_documents(
  p_tenant_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  subject TEXT,
  file_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.name, d.subject, d.file_type, d.status, d.created_at,
         ts_rank(d.search_vector, plainto_tsquery('simple', p_query)) AS rank
  FROM documents d
  WHERE d.tenant_id = p_tenant_id
    AND d.status != 'deleted'
    AND d.search_vector @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing documents search vectors
UPDATE documents SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(subject, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(notes, '')), 'C');

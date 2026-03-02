
-- AI-02: Prompt registry for centralized AI prompt management (ISO 42001)
CREATE TABLE public.ai_prompt_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-3-flash-preview',
  temperature NUMERIC(3,2) DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 2000,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  confidence_auto_approve NUMERIC(3,2) DEFAULT 0.85,
  confidence_flag_threshold NUMERIC(3,2) DEFAULT 0.50,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, function_name, prompt_key, version)
);

COMMENT ON COLUMN public.ai_prompt_registry.tenant_id IS 'NULL = global default prompt, non-null = tenant-specific override';

ALTER TABLE public.ai_prompt_registry ENABLE ROW LEVEL SECURITY;

-- Super admins (those with super_admin role in user_roles) can manage all prompts
CREATE POLICY "Super admins manage all prompts"
  ON public.ai_prompt_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Tenant members can view their prompts"
  ON public.ai_prompt_registry FOR SELECT
  USING (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = ai_prompt_registry.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.status = 'active'
    )
  );

CREATE TRIGGER update_ai_prompt_registry_updated_at
  BEFORE UPDATE ON public.ai_prompt_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_prompt_registry_lookup
  ON public.ai_prompt_registry(function_name, prompt_key, is_active);

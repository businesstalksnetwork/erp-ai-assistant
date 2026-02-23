
-- AI Narrative Cache for analytics narrative caching (30 min TTL)
CREATE TABLE IF NOT EXISTS public.ai_narrative_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  narrative TEXT NOT NULL DEFAULT '',
  recommendations JSONB NOT NULL DEFAULT '[]',
  data_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX idx_ai_narrative_cache_lookup ON public.ai_narrative_cache(tenant_id, context_type, expires_at);

ALTER TABLE public.ai_narrative_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read narrative cache"
ON public.ai_narrative_cache FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert narrative cache"
ON public.ai_narrative_cache FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete narrative cache"
ON public.ai_narrative_cache FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Add title column to ai_conversations for conversation list display
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

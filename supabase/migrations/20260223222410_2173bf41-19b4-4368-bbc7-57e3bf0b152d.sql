
-- AI token usage tracking per tenant
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  function_name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant token usage"
  ON public.ai_token_usage FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE INDEX idx_ai_token_usage_tenant ON public.ai_token_usage(tenant_id, created_at DESC);
CREATE INDEX idx_ai_token_usage_user ON public.ai_token_usage(user_id, created_at DESC);

-- AI rate limit tracking
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  UNIQUE(user_id, tenant_id, window_start)
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to rate limits"
  ON public.ai_rate_limits FOR SELECT
  USING (false);

-- Pinned conversations
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Anomaly baselines
CREATE TABLE IF NOT EXISTS public.ai_anomaly_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  mean_value NUMERIC NOT NULL DEFAULT 0,
  stddev_value NUMERIC NOT NULL DEFAULT 0,
  sample_count INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, metric_key)
);

ALTER TABLE public.ai_anomaly_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant baselines"
  ON public.ai_anomaly_baselines FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

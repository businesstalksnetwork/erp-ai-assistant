
-- AI Conversations table
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create AI conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their own AI conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their own AI conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Insights Cache table
CREATE TABLE public.ai_insights_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour')
);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view insights"
  ON public.ai_insights_cache FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "System can manage insights"
  ON public.ai_insights_cache FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ai_insights_tenant_expires ON public.ai_insights_cache(tenant_id, expires_at);
CREATE INDEX idx_ai_conversations_tenant_user ON public.ai_conversations(tenant_id, user_id);

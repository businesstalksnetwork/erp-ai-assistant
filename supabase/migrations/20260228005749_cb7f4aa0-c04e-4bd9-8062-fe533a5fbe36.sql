
-- AI Feedback table for tracking user satisfaction with AI responses
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  message_index INT,
  feedback TEXT NOT NULL CHECK (feedback IN ('positive', 'negative')),
  comment TEXT,
  context_module TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON public.ai_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
  ON public.ai_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tenant feedback"
  ON public.ai_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = ai_feedback.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('admin', 'manager')
        AND tm.status = 'active'
    )
  );

CREATE INDEX idx_ai_feedback_tenant ON public.ai_feedback(tenant_id);
CREATE INDEX idx_ai_feedback_created ON public.ai_feedback(created_at DESC);

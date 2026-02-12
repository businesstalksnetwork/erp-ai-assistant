
-- ============================================================
-- Event Bus System: Tables, Functions, Triggers, Seed Data
-- ============================================================

-- 1. module_events — stores every emitted event
CREATE TABLE public.module_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_events_tenant ON public.module_events(tenant_id);
CREATE INDEX idx_module_events_status ON public.module_events(status);
CREATE INDEX idx_module_events_type ON public.module_events(event_type);
CREATE INDEX idx_module_events_created ON public.module_events(created_at DESC);

ALTER TABLE public.module_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their events"
  ON public.module_events FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert events"
  ON public.module_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins full access to events"
  ON public.module_events FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- 2. module_event_subscriptions — maps event types to handler functions
CREATE TABLE public.module_event_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  handler_module TEXT NOT NULL,
  handler_function TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_subs_type ON public.module_event_subscriptions(event_type);

ALTER TABLE public.module_event_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read subscriptions"
  ON public.module_event_subscriptions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins manage subscriptions"
  ON public.module_event_subscriptions FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- 3. module_event_logs — execution logs per subscription handler
CREATE TABLE public.module_event_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.module_events(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.module_event_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  response JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_logs_event ON public.module_event_logs(event_id);

ALTER TABLE public.module_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view logs for their events"
  ON public.module_event_logs FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.module_events
      WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Super admins full access to event logs"
  ON public.module_event_logs FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- 4. emit_module_event helper function
CREATE OR REPLACE FUNCTION public.emit_module_event(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_source_module TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_max_retries INT DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.module_events (tenant_id, event_type, source_module, entity_type, entity_id, payload, max_retries)
  VALUES (p_tenant_id, p_event_type, p_source_module, p_entity_type, p_entity_id, p_payload, p_max_retries)
  RETURNING id INTO v_event_id;

  -- Notify listeners with event id and type (lightweight)
  PERFORM pg_notify('module_event', json_build_object('event_id', v_event_id, 'event_type', p_event_type)::text);

  RETURN v_event_id;
END;
$$;

-- 5. pg_notify trigger on INSERT (backup if emit_module_event isn't used directly)
CREATE OR REPLACE FUNCTION public.notify_module_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_notify('module_event', json_build_object('event_id', NEW.id, 'event_type', NEW.event_type)::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_module_event
  AFTER INSERT ON public.module_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_module_event();

-- 6. Seed default subscriptions
INSERT INTO public.module_event_subscriptions (event_type, handler_module, handler_function) VALUES
  ('invoice.posted', 'inventory', 'process-module-event'),
  ('sales_order.confirmed', 'inventory', 'process-module-event'),
  ('production.completed', 'inventory', 'process-module-event'),
  ('pos.transaction_completed', 'inventory', 'process-module-event'),
  ('pos.transaction_completed', 'accounting', 'process-module-event');


-- Fix RLS on kalkulacija_items and nivelacija_items
ALTER TABLE public.kalkulacija_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kalkulacija_items_access" ON public.kalkulacija_items FOR ALL USING (
  kalkulacija_id IN (SELECT id FROM kalkulacije WHERE tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'))
);

ALTER TABLE public.nivelacija_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nivelacija_items_access" ON public.nivelacija_items FOR ALL USING (
  nivelacija_id IN (SELECT id FROM nivelacije WHERE tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'))
);

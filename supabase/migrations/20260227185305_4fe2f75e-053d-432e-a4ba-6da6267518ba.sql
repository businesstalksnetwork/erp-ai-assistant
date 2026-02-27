
-- Add department_id to invoices first
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);

-- Now create the data-scope-aware SELECT policy for invoices
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
CREATE POLICY "Members can view invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (
      get_member_data_scope(auth.uid(), tenant_id) = 'all'
      OR (get_member_data_scope(auth.uid(), tenant_id) = 'own' AND created_by = auth.uid())
      OR (get_member_data_scope(auth.uid(), tenant_id) = 'department' AND department_id = ANY(get_member_department_ids(auth.uid(), tenant_id)))
    )
  )
);

-- Update opportunities: drop old ALL policy, add scoped SELECT + separate mutation policy
DROP POLICY IF EXISTS "Tenant members can manage opportunities" ON public.opportunities;

CREATE POLICY "Members can view opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (
      get_member_data_scope(auth.uid(), tenant_id) = 'all'
      OR (get_member_data_scope(auth.uid(), tenant_id) = 'own' AND assigned_to = auth.uid())
    )
  )
);

CREATE POLICY "Members can mutate opportunities" ON public.opportunities
FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);

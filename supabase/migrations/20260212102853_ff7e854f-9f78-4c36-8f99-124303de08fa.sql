
-- Create tenant_settings table
CREATE TABLE public.tenant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{
    "invoice_prefix": "INV",
    "invoice_next_seq": 1,
    "journal_prefix": "JE",
    "journal_next_seq": 1,
    "default_receivable_account_id": null,
    "default_revenue_account_id": null,
    "default_tax_account_id": null,
    "default_cash_account_id": null,
    "default_cogs_account_id": null,
    "default_currency": "RSD",
    "fiscal_year_start_month": 1,
    "journal_approval_threshold": null,
    "auto_post_invoices": false
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Members can view their tenant settings
CREATE POLICY "Members can view tenant settings"
ON public.tenant_settings
FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Tenant admins can manage settings
CREATE POLICY "Tenant admins manage tenant settings"
ON public.tenant_settings
FOR ALL
USING (tenant_id IN (
  SELECT tenant_members.tenant_id FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
    AND tenant_members.role = 'admin'::app_role
    AND tenant_members.status = 'active'::membership_status
));

-- Super admins can manage all settings
CREATE POLICY "Super admins manage tenant settings"
ON public.tenant_settings
FOR ALL
USING (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings for existing tenants
INSERT INTO public.tenant_settings (tenant_id)
SELECT id FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.tenant_settings);

-- Create trigger to auto-seed settings for new tenants
CREATE OR REPLACE FUNCTION public.seed_tenant_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_settings (tenant_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER seed_tenant_settings_on_create
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.seed_tenant_settings();

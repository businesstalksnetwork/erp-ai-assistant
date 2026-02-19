
CREATE TABLE IF NOT EXISTS public.legacy_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  zip_filename text,
  zip_storage_path text,
  analysis jsonb DEFAULT '[]'::jsonb,
  confirmed_mapping jsonb DEFAULT '[]'::jsonb,
  import_results jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'uploading',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legacy_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage their import sessions"
ON public.legacy_import_sessions
FOR ALL
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE TRIGGER update_legacy_import_sessions_updated_at
BEFORE UPDATE ON public.legacy_import_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

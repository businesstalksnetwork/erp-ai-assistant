
-- 1. opportunity_documents
CREATE TABLE public.opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.opportunity_documents FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 2. opportunity_comments
CREATE TABLE public.opportunity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  parent_id uuid REFERENCES public.opportunity_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunity_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.opportunity_comments FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_opportunity_comments_updated_at
  BEFORE UPDATE ON public.opportunity_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. opportunity_activities
CREATE TABLE public.opportunity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.opportunity_activities FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 4. opportunity_tags
CREATE TABLE public.opportunity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag text NOT NULL,
  color text DEFAULT '#6B7280',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, tag)
);
ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.opportunity_tags FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 5. opportunity_followers
CREATE TABLE public.opportunity_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, user_id)
);
ALTER TABLE public.opportunity_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.opportunity_followers FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Indexes for performance
CREATE INDEX idx_opp_docs_opp ON public.opportunity_documents(opportunity_id);
CREATE INDEX idx_opp_comments_opp ON public.opportunity_comments(opportunity_id);
CREATE INDEX idx_opp_activities_opp ON public.opportunity_activities(opportunity_id);
CREATE INDEX idx_opp_tags_opp ON public.opportunity_tags(opportunity_id);
CREATE INDEX idx_opp_followers_opp ON public.opportunity_followers(opportunity_id);

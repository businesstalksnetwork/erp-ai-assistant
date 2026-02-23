
-- Invoice view tracking
CREATE TABLE public.invoice_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id),
  company_id UUID REFERENCES public.companies(id),
  email_log_id UUID REFERENCES public.invoice_email_log(id),
  tracking_token TEXT UNIQUE NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_url_expires_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- In-app notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  reference_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS for invoice_views
ALTER TABLE public.invoice_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company invoice views"
  ON public.invoice_views FOR SELECT
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_invoice_views_tracking_token ON public.invoice_views(tracking_token);
CREATE INDEX idx_invoice_views_invoice_id ON public.invoice_views(invoice_id);
CREATE INDEX idx_notifications_user_id_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

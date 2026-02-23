-- Create email notification log table
CREATE TABLE public.email_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'reminder_day_before', 'reminder_due_date', 'limit_80_6m', 'limit_90_6m', 'limit_80_8m', 'limit_90_8m'
  reference_id UUID, -- reminder_id or null for limit notifications
  reference_date DATE, -- the date this notification was for (to prevent duplicates)
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_email_notification_log_company ON public.email_notification_log(company_id);
CREATE INDEX idx_email_notification_log_type_date ON public.email_notification_log(notification_type, reference_date);
CREATE INDEX idx_email_notification_log_reference ON public.email_notification_log(reference_id, notification_type, reference_date);

-- RLS policy - users can view their own email logs
CREATE POLICY "Users can view their own email logs"
  ON public.email_notification_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role will insert logs, so no INSERT policy needed for regular users
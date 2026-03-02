
-- SEC-08: DB-backed rate limiting table
CREATE TABLE public.rate_limit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  ts timestamptz NOT NULL DEFAULT now()
);

-- Index for fast sliding-window lookups
CREATE INDEX idx_rate_limit_log_key_ts ON public.rate_limit_log (key, ts DESC);

-- Index for cleanup
CREATE INDEX idx_rate_limit_log_ts ON public.rate_limit_log (ts);

-- Enable RLS but allow service_role only (edge functions use service_role key)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role can access
-- This table is used exclusively by edge functions via service_role key

-- Cleanup function: remove entries older than 5 minutes
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_log WHERE ts < now() - interval '5 minutes';
$$;

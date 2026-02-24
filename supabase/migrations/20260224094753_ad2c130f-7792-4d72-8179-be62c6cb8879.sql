
-- Add language column to ai_insights_cache for per-language caching
ALTER TABLE public.ai_insights_cache ADD COLUMN IF NOT EXISTS language varchar(5) DEFAULT 'en';

-- Drop old index if exists and create new one including language
DROP INDEX IF EXISTS idx_ai_insights_cache_tenant_expires;
CREATE INDEX idx_ai_insights_cache_tenant_lang_expires ON public.ai_insights_cache (tenant_id, language, expires_at);

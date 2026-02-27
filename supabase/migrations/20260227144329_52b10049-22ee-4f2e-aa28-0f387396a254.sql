
SELECT cron.schedule(
  'recurring-invoice-generate',
  '0 6 * * *',
  $$
  select net.http_post(
    url:='https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/recurring-invoice-generate',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmdm9laHNyc2ltdmd5eXhpcndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDQzMTUsImV4cCI6MjA4NjQyMDMxNX0.izp1i5B2LvtabTSgQFakkvtw6UH0yAPEIuQY8-E60qg"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'recurring-journal-generate',
  '5 6 * * *',
  $$
  select net.http_post(
    url:='https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/recurring-journal-generate',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmdm9laHNyc2ltdmd5eXhpcndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDQzMTUsImV4cCI6MjA4NjQyMDMxNX0.izp1i5B2LvtabTSgQFakkvtw6UH0yAPEIuQY8-E60qg"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);



# Fix CORS Headers on All Edge Functions

## Problem

The user on `pausalbox.aiknjigovodja.rs` sees an infinite loading spinner. The root cause: **27 out of 32 edge functions have incomplete CORS headers**. The newer Supabase JS client (`@supabase/supabase-js@2.89`) sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`) in every request. When these headers are not listed in the `Access-Control-Allow-Headers` response, the browser blocks the CORS preflight and the request fails silently -- resulting in a loading spinner that never resolves.

Only 5 functions currently have the correct headers: `verify-email`, `delete-user`, `send-verification-email`, `validate-pib`, `get-vapid-public-key`.

## Solution

Update the `corsHeaders` object in all 27 remaining edge functions to include the full set of allowed headers:

```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

## Files to Update (27 functions)

1. `supabase/functions/apr-lookup/index.ts`
2. `supabase/functions/nbs-exchange-rate/index.ts`
3. `supabase/functions/parse-pausalni-pdf/index.ts`
4. `supabase/functions/sef-accept-reject-invoice/index.ts`
5. `supabase/functions/sef-background-sync/index.ts`
6. `supabase/functions/sef-cancel-sales-invoice/index.ts`
7. `supabase/functions/sef-continue-sync/index.ts`
8. `supabase/functions/sef-enrich-invoices/index.ts`
9. `supabase/functions/sef-fetch-invoices/index.ts`
10. `supabase/functions/sef-fetch-purchase-invoices/index.ts`
11. `supabase/functions/sef-fetch-sales-invoices/index.ts`
12. `supabase/functions/sef-get-invoice-xml/index.ts`
13. `supabase/functions/sef-long-sync/index.ts` (has partial -- missing some headers, has `x-cron-token`)
14. `supabase/functions/sef-registry-auto-update/index.ts`
15. `supabase/functions/sef-registry-import/index.ts`
16. `supabase/functions/sef-send-invoice/index.ts`
17. `supabase/functions/send-admin-bulk-email/index.ts`
18. `supabase/functions/send-invoice-email/index.ts`
19. `supabase/functions/send-notification-emails/index.ts`
20. `supabase/functions/storage-cleanup/index.ts`
21. `supabase/functions/storage-delete/index.ts`
22. `supabase/functions/storage-download/index.ts`
23. `supabase/functions/storage-fix-logos/index.ts`
24. `supabase/functions/storage-get-base64/index.ts`
25. `supabase/functions/storage-migrate/index.ts`
26. `supabase/functions/storage-upload/index.ts`
27. `supabase/functions/track-invoice-view/index.ts`

## What Changes Per File

Each file has a single line change -- the `Access-Control-Allow-Headers` value changes from:

```
'authorization, x-client-info, apikey, content-type'
```

to:

```
'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

For `sef-long-sync`, the existing `x-cron-token` will be preserved in addition to the new headers.

## Impact

After deploying, all edge function calls from `pausalbox.aiknjigovodja.rs` (or any domain) will pass CORS preflight correctly. The user `rajicmont@gmail.com` and any other users accessing via the custom domain should no longer see infinite loading.


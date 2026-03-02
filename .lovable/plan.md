

## Root Cause

Two separate issues:

1. **22 edge functions reference undefined `corsHeaders` variable** — They import `getCorsHeaders` from `_shared/cors.ts` but never call it, so `corsHeaders` is undefined at runtime. These functions crash with `ReferenceError` on any request.

2. **All edge functions need redeployment** — The `_shared/cors.ts` was updated to allow `.lovableproject.com` origins, but Supabase bundles shared imports at deploy time. Already-deployed functions still use the old CORS config that blocks `.lovableproject.com`.

## Broken Functions (22 total)

Each needs `const corsHeaders = getCorsHeaders(req);` added at the start of their handler, before the OPTIONS check:

| # | Function | Handler Line |
|---|----------|-------------|
| 1 | `sef-send-invoice` | ~282 |
| 2 | `storage-fix-logos` | ~25 |
| 3 | `sef-background-sync` | ~329 |
| 4 | `parse-pausalni-pdf` | ~32 |
| 5 | `seed-demo-data` | ~83 |
| 6 | `sef-fetch-invoices` | ~24 |
| 7 | `generate-tax-payment-orders` | ~21 |
| 8 | `send-document-signature` | ~5 |
| 9 | `storage-cleanup` | ~91 |
| 10 | `storage-upload` | ~42 |
| 11 | `sef-fetch-purchase-invoices` | ~210 |
| 12 | `seed-demo-data-phase3` | ~7 |
| 13 | `send-revers-notification` | ~12 |
| 14 | `storage-delete` | ~27 |
| 15 | `sef-long-sync` | ~501 |
| 16 | `sef-enrich-invoices` | ~87 |
| 17 | `send-admin-bulk-email` | ~22 |
| 18 | `sef-submit` | ~297 |
| 19 | `sef-poll-status` | ~86 |
| 20 | `sef-registry-auto-update` | ~55 |
| 21 | `send-invoice-email` | handler |
| 22 | `send-verification-email` | ~34 |

## Fix Pattern

For each function, add `const corsHeaders = getCorsHeaders(req);` right after entering the handler, before the OPTIONS check. Example:

```typescript
// BEFORE (broken):
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }); // ← undefined!
  }

// AFTER (fixed):
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }); // ← now defined
  }
```

## Deployment

After fixing all 22 functions, all edge functions must be redeployed so the updated `_shared/cors.ts` (with `.lovableproject.com` support) takes effect across the entire fleet.




## Fix: Add `web.erpai.rs` and `.lovableproject.com` to CORS allowed origins

The CORS config in `supabase/functions/_shared/cors.ts` is missing both the production domain `https://web.erpai.rs` and the `.lovableproject.com` preview domain. This blocks all edge function calls from these origins.

### Change

**File: `supabase/functions/_shared/cors.ts`**

1. Add `https://web.erpai.rs` to `DEFAULT_ORIGINS`
2. Extend the preview check to also allow `.lovableproject.com`

```typescript
const DEFAULT_ORIGINS = [
  "https://proerpai.lovable.app",
  "https://id-preview--a347532a-0028-44d9-85ae-4e042514628f.lovable.app",
  "https://web.erpai.rs",
];

// line 27:
const isLovablePreview = origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com");
```

This single file fix restores CORS for all 97+ edge functions simultaneously since they all import from this shared module.

Also need to check and fix the two edge functions that reference `corsHeaders` directly instead of using the shared module (`storage-download` and `verify-email`) — they use an undefined `corsHeaders` variable which would cause runtime errors.

**File: `supabase/functions/storage-download/index.ts`** — Replace `corsHeaders` with `getCorsHeaders(req)` calls and add the import.

**File: `supabase/functions/verify-email/index.ts`** — Same fix: replace bare `corsHeaders` references with `getCorsHeaders(req)`.


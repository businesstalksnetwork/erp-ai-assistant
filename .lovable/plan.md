

## Adopt `createErrorResponse()` and `withSecurityHeaders()` Across All Edge Functions

### Problem (CR8-03 + CR8-04)

Two shared modules exist but are imported by **zero** edge functions:
- `_shared/error-handler.ts` — `createErrorResponse()` and `createJsonResponse()` sanitize error messages (no stack traces/internals leaked to clients)
- `_shared/security-headers.ts` — `withSecurityHeaders()` adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.

All 100+ functions currently use raw `error.message` or `String(e)` in catch blocks, exposing internal details to clients.

### Scope

Every edge function that has:
1. A `catch` block returning `JSON.stringify({ error: error.message })` or `String(e)` → replace with `createErrorResponse(error, req)`
2. Success JSON responses → wrap headers with `withSecurityHeaders()`

### Fix Pattern

For each function, add two imports and apply them:

```typescript
// ADD these imports:
import { createErrorResponse, createJsonResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

// REPLACE catch blocks:
// BEFORE:
} catch (e) {
  console.error("xxx error:", e);
  return new Response(JSON.stringify({ error: e.message }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// AFTER:
} catch (e) {
  return createErrorResponse(e, req, { logPrefix: "xxx error" });
}

// REPLACE success responses:
// BEFORE:
return new Response(JSON.stringify({ data }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// AFTER:
return new Response(JSON.stringify({ data }), {
  headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
});
```

### Implementation Batches

Due to the volume (~100 functions), this will be done in batches:

**Batch 1 — AI functions (11):** `ai-analytics-narrative`, `ai-assistant`, `ai-bank-categorize`, `ai-cash-flow-predict`, `ai-daily-digest`, `ai-executive-briefing`, `ai-insights`, `ai-invoice-anomaly`, `ai-payroll-predict`, `ai-supplier-scoring`, `ai-weekly-email`, `ai-year-end-check`

**Batch 2 — SEF/invoice functions (12):** `sef-send-invoice`, `sef-background-sync`, `sef-fetch-invoices`, `sef-fetch-purchase-invoices`, `sef-fetch-sales-invoices`, `sef-submit`, `sef-poll-status`, `sef-enrich-invoices`, `sef-long-sync`, `sef-get-invoice-xml`, `sef-accept-reject-invoice`, `sef-cancel-sales-invoice`

**Batch 3 — Storage/utility (12):** `storage-upload`, `storage-download`, `storage-delete`, `storage-cleanup`, `storage-fix-logos`, `storage-get-base64`, `storage-migrate`, `generate-pdf`, `generate-pdfa`, `generate-payment-orders`, `generate-tax-payment-orders`, `document-ocr`

**Batch 4 — Email/notification (6):** `send-invoice-email`, `send-verification-email`, `send-document-signature`, `send-revers-notification`, `send-admin-bulk-email`, `send-notification-emails`

**Batch 5 — Import/seed/admin (10):** `import-legacy-products`, `import-legacy-contacts`, `import-legacy-partners`, `import-bcility-data`, `import-legacy-zip`, `analyze-legacy-zip`, `seed-demo-data`, `seed-demo-data-phase2`, `seed-demo-data-phase3`, `clear-tenant-data`

**Batch 6 — Remaining (50+):** All other functions including XML generators, CRM, compliance, NBS, APR, POS, tenant, health-check, etc.

### Also Fix CR8-02

Update `_shared/error-handler.ts` to sanitize 4xx errors too (currently only 500s are sanitized):

```typescript
// BEFORE:
const safeMessage =
  status < 500 && error instanceof Error
    ? error.message
    : SAFE_MESSAGES[status] || SAFE_MESSAGES[500];

// AFTER:
const safeMessage = SAFE_MESSAGES[status] || SAFE_MESSAGES[500];
```

### Deployment

After all batches, redeploy all functions so security headers and sanitized errors take effect globally.

### Impact

- Closes CR8-03 (HIGH) and CR8-04 (HIGH)
- Closes CR8-02 (MEDIUM) and CR8-07 (LOW)
- Security posture: 7.5/10 → ~9/10
- Closes CR6-05 and CR6-06


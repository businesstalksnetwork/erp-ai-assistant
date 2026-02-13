
# Deno Tests for fiscalize-receipt and sef-submit Edge Functions

## Overview

Create integration tests for both Edge Functions that call the deployed functions via HTTP and validate responses for various scenarios (auth failures, missing data, successful payloads).

---

## Test Strategy

Both functions require authenticated users with tenant membership and database records (fiscal devices, SEF connections, invoices). The tests will:

1. Call the deployed Edge Function endpoints directly using `fetch`
2. Validate error handling (missing auth, missing tenant_id, missing device/connection)
3. Validate CORS (OPTIONS preflight)
4. For authenticated tests, use the Supabase anon key from the `.env` file

Since these functions depend on real database state (devices, invoices, connections), the tests focus on:
- **Unauthenticated requests** returning 401
- **CORS preflight** returning proper headers
- **Missing required fields** returning 400
- **Response structure validation** for error payloads

---

## Files Created

### 1. `supabase/functions/fiscalize-receipt/index.test.ts`

Test cases:
- **CORS preflight**: OPTIONS request returns 200 with CORS headers
- **No auth header**: Returns 401 with `{ error: "Unauthorized" }`
- **Invalid auth token**: Returns 401
- **Missing device_id**: Returns 404 ("Fiscal device not found") or appropriate error
- **Valid payload structure check**: Ensures response JSON has expected keys (`success`, `receipt_number`, `offline`, etc.) or a structured error

### 2. `supabase/functions/sef-submit/index.test.ts`

Test cases:
- **CORS preflight**: OPTIONS request returns 200 with CORS headers
- **No auth header**: Returns 401 with `{ error: "Unauthorized" }`
- **Invalid auth token**: Returns 401
- **Missing tenant_id**: Returns 400 with `{ error: "tenant_id required" }`
- **Missing invoice_id with test=false**: Returns 400 with `{ error: "invoice_id required" }` (after auth + tenant check)
- **Response structure validation**: Error responses contain `error` or `message` field

---

## Technical Details

### Environment Setup

Both test files load credentials from the project `.env`:

```typescript
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
```

### Test Pattern

Each test follows the pattern:
```typescript
Deno.test("description", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/function-name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  assertEquals(res.status, expectedStatus);
  assertEquals(body.error, expectedError);
});
```

All response bodies are consumed to prevent Deno resource leaks.

### Key Assertions

**fiscalize-receipt**:
- 401 when no Authorization header
- 401 when Authorization is `Bearer invalid-token`
- OPTIONS returns `Access-Control-Allow-Origin: *`

**sef-submit**:
- 401 when no Authorization header
- 400 when body has no `tenant_id`
- OPTIONS returns `Access-Control-Allow-Origin: *`
- Error responses always have `error` or `message` key


# Fix Resend Rate Limiting in Bulk Email Function

## Problem

The `send-admin-bulk-email` edge function sends emails in a tight `for` loop with no delay between requests. Resend's free/standard tier allows only **2 requests per second**. When sending to 11 recipients, 7 out of 11 failed with `429 rate_limit_exceeded`.

## Solution

Add a 600ms delay between each email send in the loop. This keeps the rate safely under 2 requests/second (roughly 1.6/sec). Also add retry logic: if a 429 is received, wait 1.5 seconds and retry once.

## Changes

### `supabase/functions/send-admin-bulk-email/index.ts`

1. Add a helper `sleep` function at the top
2. After each successful or failed send, add `await sleep(600)` to space out requests
3. On 429 errors specifically, retry once after a 1.5s wait before marking as failed

```typescript
// Add at top of file
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// In the loop, after the resend.emails.send call and logging:
// Add delay between sends
await sleep(600);

// On 429 error, retry once:
if (emailRes.error?.statusCode === 429) {
  console.log(`Rate limited for ${recipient.email}, retrying after 1.5s...`);
  await sleep(1500);
  // retry send...
}
```

This single file change ensures all bulk emails go through without hitting rate limits. The edge function will be automatically redeployed.

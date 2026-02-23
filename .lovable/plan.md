

## Fix: "Create Quote" 404 from Opportunity Detail

### Problem
When clicking "Kreiraj ponudu" (Create Quote) on the Opportunity Detail page, the app navigates to `/crm/quotes` -- but that route does not exist. The correct route is `/sales/quotes`.

### Fix

**File: `src/pages/tenant/OpportunityDetail.tsx`** (line ~148)

Change:
```ts
navigate("/crm/quotes");
```
To:
```ts
navigate("/sales/quotes");
```

This is a single-line fix that corrects the navigation target to the actual registered route.


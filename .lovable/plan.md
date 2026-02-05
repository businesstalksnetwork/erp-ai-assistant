
# Plan: Fix NBS Exchange Rate Not Fetching

## Problem Summary

Exchange rate for foreign currencies (EUR, USD, etc.) is **not being automatically fetched** when creating invoices (predračun or račun) for foreign clients. The `nbs-exchange-rate` backend function exists in the code but is NOT deployed.

## Root Cause

The `nbs-exchange-rate` function returns a **404 Not Found** error - it exists in the codebase but hasn't been deployed to the live environment.

## Solution

### Step 1: Deploy the Backend Function
Deploy the `nbs-exchange-rate` function so it can be called by the frontend.

### Step 2: Improve Error Handling
Add user feedback when the exchange rate fetch fails, so users know when something goes wrong instead of silently failing.

---

## Technical Details

### Backend Function Deployment
- File: `supabase/functions/nbs-exchange-rate/index.ts`
- Status: Code exists, needs deployment
- API used: `kurs.resenje.org` (public NBS rates API)

### Frontend Logic (already correct)
The fetch logic in `src/pages/NewInvoice.tsx` (lines 172-207) is correct:
- Triggers when `client_type === 'foreign'` OR `useForeignCalculation` is true
- Requires both `foreign_currency` and `issue_date` to be set
- Calls the backend function with currency and date

### Error Handling Improvement
Currently, errors are only logged to console. Will add a toast notification when the rate fetch fails so users are aware and can retry.

---

## Expected Behavior After Fix
1. Select a foreign client or enable "Cena dogovorena u devizama"
2. Choose a currency (EUR, USD, etc.)
3. System automatically fetches the NBS middle rate for the issue date
4. Exchange rate field populates automatically
5. RSD prices calculate from foreign amounts × exchange rate

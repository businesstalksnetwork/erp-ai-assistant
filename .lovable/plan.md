

# Fix Remaining Known Issues (6 Items)

This plan addresses all 6 remaining known issues: generate-pdf JWT fix (already partially done), web-order-import webhook signature validation, useTenant multi-tenant support, Kalkulacija/Nivelacija journal posting RPCs, fixed asset account code corrections, and all other frontend files still using old Anglo-Saxon account codes.

---

## Issue 1: generate-pdf -- Already Has JWT

**Finding**: The `generate-pdf` edge function at lines 24-45 already validates JWT via `getUser()` and checks tenant membership at lines 77-89. This issue is **already resolved** from the previous implementation. No changes needed.

---

## Issue 2: web-order-import -- Add HMAC Webhook Signature Validation

The `web_connections` table already has a `webhook_secret` column. We'll use it for HMAC-SHA256 signature verification.

### Changes: `supabase/functions/web-order-import/index.ts`

After identifying the connection (line 43), add HMAC validation:

```
if (conn.webhook_secret) {
  const signature = req.headers.get("x-webhook-signature") 
    || req.headers.get("x-shopify-hmac-sha256")
    || req.headers.get("x-wc-webhook-signature");
  
  if (!signature) return 401 "Missing webhook signature";
  
  // Compute HMAC-SHA256 of raw body using webhook_secret
  const key = await crypto.subtle.importKey(...)
  const computed = base64(await crypto.subtle.sign(..., bodyBytes))
  if (computed !== signature) return 401 "Invalid signature";
}
```

This is compatible with Shopify (sends `X-Shopify-Hmac-Sha256`) and WooCommerce (sends `X-WC-Webhook-Signature`) out of the box.

---

## Issue 3: useTenant -- Multi-Tenant Support

### Problem
`useTenant()` uses `.maybeSingle()` which fails silently when a user belongs to multiple tenants -- it only returns the first one.

### Solution
- Fetch ALL active memberships (not just one)
- Store a `selectedTenantId` in localStorage for persistence
- If user has multiple tenants, use the stored selection or default to first
- Export a `tenants` array and `switchTenant()` function
- Add a TenantSelector dropdown component to the layout header

### Changes

**`src/hooks/useTenant.ts`** -- Return all memberships + selection logic:
- Query with `.select()` instead of `.maybeSingle()`
- Return `{ tenants, tenantId, role, switchTenant, isLoading }`
- Use `localStorage.getItem("selectedTenantId")` for persistence

**New: `src/components/TenantSelector.tsx`** -- Dropdown in header:
- Only renders if user has 2+ tenants
- Shows current tenant name with a Select dropdown
- Calls `switchTenant(id)` on change

**`src/layouts/TenantLayout.tsx`** -- Add TenantSelector to header area

---

## Issue 4: Kalkulacija/Nivelacija -- Wire Journal Posting via RPC

### Problem
Both pages create documents (rows in `kalkulacije`/`nivelacije` tables) but do NOT create the required journal entries for the 1320/1329 accounting. They only save data -- no GL impact.

### Solution: Database RPCs

**New RPC: `post_kalkulacija(p_kalkulacija_id uuid)`**

When a kalkulacija is "posted":
- D: 1320 Roba u maloprodaji (total retail price x qty)
- P: 1329 Razlika u ceni (markup portion = retail - cost, per item x qty)
- P: 1300 Roba (total purchase cost x qty)
- Updates `kalkulacije.status = 'posted'` and sets `journal_entry_id`

**New RPC: `post_nivelacija(p_nivelacija_id uuid)`**

When a nivelacija is "posted":
- If total price difference > 0 (price increase):
  - D: 1320 (increase amount)
  - P: 1329 (increase in RuC)
- If total price difference < 0 (price decrease):
  - D: 1329 (decrease RuC)
  - P: 1320 (decrease amount)
- Updates `nivelacije.status = 'posted'` and sets `journal_entry_id`

### UI Changes

**`src/pages/tenant/Kalkulacija.tsx`**:
- Add "Post" button on draft kalkulacije rows
- Calls `supabase.rpc("post_kalkulacija", { p_kalkulacija_id: id })`
- Shows "posted" badge after success

**`src/pages/tenant/Nivelacija.tsx`**:
- Same pattern: "Post" button on draft rows
- Calls `supabase.rpc("post_nivelacija", { p_nivelacija_id: id })`

---

## Issue 5: Fixed Asset Disposal -- Wrong Account Codes

### Current (Wrong)
The `FixedAssets.tsx` disposal logic uses:
- `1290` for accumulated depreciation (not in Serbian CoA seed)
- `1200` to credit asset removal (1200 = Gotovi proizvodi, NOT fixed assets)
- `8210` / `8200` for gain/loss (class 8 is legacy/inactive)
- `8100` for depreciation expense (should be `5310`)
- `8300` for interest expense in Loans (should be `5330`)
- `8000` for expense recognition in Deferrals (should be appropriate 5xxx)

### Correct Serbian Account Mapping

| Module | Old Code | New Code | Account Name |
|--------|----------|----------|-------------|
| FixedAssets: Depreciation expense | 8100 | 5310 | Amortizacija |
| FixedAssets: Accum. depreciation | 1290 | 0121 | Akumulirana amortizacija - oprema |
| FixedAssets: Asset removal credit | 1200 | 0120 | Masine i oprema |
| FixedAssets: Gain on disposal | 8210 | 6072 | Pozitivne kursne razlike (or new 6900 account) |
| FixedAssets: Loss on disposal | 8200 | 5073 | Rashodi od otpisa |
| FixedAssets: Sale proceeds debit | 2410 | 2431 | Tekuci racun |
| Loans: Interest expense | 8300 | 5330 | Kamatni rashodi |
| Loans: Bank payment | 1000 | 2431 | Tekuci racun |
| Loans: Bank receipt | 1000 | 2431 | Tekuci racun |
| Loans: Loan receivable | 1300 | 2040 | Kupci (or dedicated loan receivable) |
| Loans: Loan payable principal | 2200 | 4200 | Dugorocne obaveze |
| Loans: Interest income | 4100 | 6020 | Prihod od usluga (or new 6600) |
| Deferrals: Expense recognized | 8000 | 5400 | Troskovi usluga |
| Deferrals: Prepaid expense | 1800 | 1500 | Unapred placeni troskovi |
| Deferrals: Deferred revenue | 2500 | 4600 | Prihodi buducih perioda |
| Deferrals: Revenue recognized | 4000 | 6010 | Prihod od prodaje |
| FxRevaluation: FX Gain | 6700 | 6072 | Pozitivne kursne razlike |
| FxRevaluation: FX Loss | 5700 | 5072 | Negativne kursne razlike |
| FxRevaluation: AR offset | 2020 | 2040 | Kupci |
| FxRevaluation: AP offset | 4320 | 4350 | Dobavljaci |
| Kompenzacija: AP offset | 4320 | 4350 | Dobavljaci |
| Kompenzacija: AR offset | 2020 | 2040 | Kupci |

### Files to Update

| File | Changes |
|------|---------|
| `src/pages/tenant/FixedAssets.tsx` | 1290->0121, 1200->0120, 8210->6072, 8200->5073, 8100->5310, 2410->2431 |
| `src/pages/tenant/Loans.tsx` | 2200->4200, 8300->5330, 1000->2431, 1300->2040, 4100->6020 |
| `src/pages/tenant/Deferrals.tsx` | 8000->5400, 1800->1500, 2500->4600, 4000->6010 |
| `src/pages/tenant/FxRevaluation.tsx` | 6700->6072, 5700->5072, 2020->2040, 4320->4350 |
| `src/pages/tenant/Kompenzacija.tsx` | 4320->4350, 2020->2040 |

---

## Issue 6: eBolovanje Integration -- Not in Scope

eBolovanje (electronic sick leave reporting, mandatory since Jan 2026) requires integration with the RFZO (Republic Health Insurance Fund) API. This is a separate feature that needs:
- API credentials and endpoint documentation from RFZO
- New DB table for sick leave records
- Edge function to submit XML to RFZO

This is noted as a future task and will NOT be implemented in this plan -- it requires external API access and government-issued credentials.

---

## Implementation Order

1. **Database migration**: Create `post_kalkulacija` and `post_nivelacija` RPCs
2. **Fix account codes**: Update all 5 frontend files with wrong codes (FixedAssets, Loans, Deferrals, FxRevaluation, Kompenzacija)
3. **Wire Kalkulacija/Nivelacija pages**: Add Post button calling RPCs
4. **web-order-import**: Add HMAC signature validation
5. **useTenant**: Multi-tenant support + TenantSelector component
6. **TenantLayout**: Add TenantSelector to header

### Files Summary

| File | Action |
|------|--------|
| Migration SQL | New RPCs: post_kalkulacija, post_nivelacija |
| `src/pages/tenant/FixedAssets.tsx` | Fix 6 account codes |
| `src/pages/tenant/Loans.tsx` | Fix 5 account codes |
| `src/pages/tenant/Deferrals.tsx` | Fix 4 account codes |
| `src/pages/tenant/FxRevaluation.tsx` | Fix 4 account codes |
| `src/pages/tenant/Kompenzacija.tsx` | Fix 2 account codes |
| `src/pages/tenant/Kalkulacija.tsx` | Add Post button + RPC call |
| `src/pages/tenant/Nivelacija.tsx` | Add Post button + RPC call |
| `supabase/functions/web-order-import/index.ts` | Add HMAC validation |
| `src/hooks/useTenant.ts` | Multi-tenant fetch + switchTenant |
| `src/components/TenantSelector.tsx` | New component |
| `src/layouts/TenantLayout.tsx` | Add TenantSelector to header |


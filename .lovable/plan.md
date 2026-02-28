

## Phase 12 — Loyalty Module (New Feature)

### Current State
- **No loyalty infrastructure exists** — zero tables, zero pages, zero RPCs
- `partners` table has `account_tier` (A/B/C/D revenue-based) and `buyer_partner_id` on `pos_transactions` — these are integration points
- CRM already has tier refresh edge function (`crm-tier-refresh`) — loyalty tiers are separate from CRM tiers
- POS transactions track `total`, `buyer_partner_id`, `items` (JSONB) — can be used for points accrual

### Plan (10 items)

#### 1. Database: Core loyalty tables (migration)
- `loyalty_programs` — tenant program config (name, points_per_unit_currency, tier_thresholds JSONB, active)
- `loyalty_members` — partner enrollment (partner_id FK, points_balance, lifetime_points, current_tier, enrolled_at)
- `loyalty_transactions` — points ledger (member_id FK, points, type: earn/redeem/adjust/expire, reference_type, reference_id, description)
- `loyalty_rewards` — redeemable catalog (name, points_cost, reward_type: discount_pct/discount_fixed/free_product/voucher, reward_value, active)
- `loyalty_redemptions` — redemption history (member_id, reward_id, points_spent, status, redeemed_at)
- All with `tenant_id`, RLS policies, timestamps

#### 2. Database: Loyalty RPCs
- `accrue_loyalty_points(p_tenant_id, p_partner_id, p_amount, p_reference_type, p_reference_id)` — calculates points from amount, inserts transaction, updates balance + lifetime, recalculates tier
- `redeem_loyalty_points(p_tenant_id, p_member_id, p_reward_id)` — validates balance, deducts points, creates redemption record
- `get_loyalty_summary(p_tenant_id, p_partner_id)` — returns balance, tier, recent transactions, available rewards

#### 3. Wire POS to loyalty: auto-accrue points on sale
- In `PosTerminal.tsx`: after successful transaction with `buyer_partner_id`, call `accrue_loyalty_points` RPC
- Show points earned in receipt confirmation toast

#### 4. Wire invoices to loyalty: accrue on invoice posting
- In `InvoiceForm.tsx`: after successful invoice posting with a partner, call `accrue_loyalty_points`

#### 5. Loyalty Hub Dashboard page
- New page `LoyaltyDashboard.tsx` at `/loyalty`
- KPIs: total members, total points outstanding, redemptions this month, top tier distribution
- Recent activity feed

#### 6. Loyalty Program Settings page
- New page `LoyaltyPrograms.tsx` at `/loyalty/programs`
- CRUD for programs: points per currency unit, tier thresholds (Bronze/Silver/Gold/Platinum), expiry rules
- Only one active program per tenant

#### 7. Loyalty Members page
- New page `LoyaltyMembers.tsx` at `/loyalty/members`
- List with search, tier filter, points balance, enrollment date
- Enroll existing partner, manual points adjustment
- Click → member detail with transaction history

#### 8. Loyalty Rewards Catalog page
- New page `LoyaltyRewards.tsx` at `/loyalty/rewards`
- CRUD for rewards: name, points cost, type (% discount, fixed discount, free product, voucher), active toggle

#### 9. Permissions & Navigation
- Add `"loyalty"` to `ModuleGroup` type and role permissions
- Add nav section in `TenantLayout.tsx` with Gift icon
- Routes in `otherRoutes.tsx`

#### 10. Translation keys
- ~25 keys: loyaltyProgram, pointsBalance, earnPoints, redeemPoints, tierBronze/Silver/Gold/Platinum, enrollMember, rewards, redemptions, etc.

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | 5 tables + 3 RPCs + RLS |
| `src/pages/tenant/LoyaltyDashboard.tsx` | New — hub dashboard |
| `src/pages/tenant/LoyaltyPrograms.tsx` | New — program settings |
| `src/pages/tenant/LoyaltyMembers.tsx` | New — member list + detail |
| `src/pages/tenant/LoyaltyRewards.tsx` | New — rewards catalog CRUD |
| `src/pages/tenant/PosTerminal.tsx` | Wire points accrual after sale |
| `src/pages/tenant/InvoiceForm.tsx` | Wire points accrual after posting |
| `src/config/rolePermissions.ts` | Add `"loyalty"` module |
| `src/routes/otherRoutes.tsx` | Add loyalty routes |
| `src/layouts/TenantLayout.tsx` | Add loyalty nav section |
| `src/i18n/translations.ts` | ~25 new keys |

### Execution Order
1. Migration: tables + RPCs + RLS (items 1-2)
2. Permissions, routes, nav, translations (items 9-10)
3. Loyalty pages: dashboard, programs, members, rewards (items 5-8)
4. POS + Invoice integration (items 3-4)


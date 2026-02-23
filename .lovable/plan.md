

# Tier 1: Critical Fixes Implementation

Three immediate actions from the blueprint, all achievable in one session.

---

## Fix 1: Update Payroll Parameters to 2026 Values

The `calculate_payroll_for_run()` database function has hardcoded fallback values from 2025. These must be updated to 2026 legal values per Sl. glasnik RS.

| Parameter | Current (2025) | Required (2026) |
|-----------|---------------|-----------------|
| neoporezivi_iznos | 28,423 RSD | 34,221 RSD |
| najniza_osnovica | 45,950 RSD | 51,297 RSD |
| najvisa_osnovica | 656,425 RSD | 732,820 RSD |

### Changes:
- **Database migration**: `ALTER FUNCTION calculate_payroll_for_run` -- update the 3 fallback defaults inside the function body
- **Seed existing tenants**: Insert/update `payroll_parameters` rows with 2026 values (effective_from = '2026-01-01') so the fallbacks are rarely used

---

## Fix 2: Secure admin-create-user and create-tenant Edge Functions

Both functions use `verify_jwt = false` and have NO authorization checks (admin-create-user) or insufficient checks (create-tenant checks super_admin but JWT is off, so anyone can call it).

### Changes for `admin-create-user/index.ts`:
- Add super_admin verification (same pattern as create-tenant): extract Authorization header, call `is_super_admin` RPC
- Return 401/403 if unauthorized

### Changes for `create-tenant/index.ts`:
- Already has super_admin check internally -- this is good
- Keep `verify_jwt = false` in config.toml (since it validates manually) but ensure the auth header validation is robust

### Changes for `seed-demo-data` functions:
- Add environment check: only run if `ENVIRONMENT !== 'production'`
- Add super_admin authorization check as a second layer of defense

---

## Fix 3: Guard seed-demo-data Functions

Three seed functions (`seed-demo-data`, `seed-demo-data-phase2`, `seed-demo-data-phase3`) and `daily-data-seed` are completely unprotected.

### Changes:
- Add super_admin authorization to all 4 functions
- Add a check that prevents execution if an `ENVIRONMENT` variable is set to `production`

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/admin-create-user/index.ts` | Add super_admin auth check |
| `supabase/functions/seed-demo-data/index.ts` | Add super_admin auth + env guard |
| `supabase/functions/seed-demo-data-phase2/index.ts` | Add super_admin auth + env guard |
| `supabase/functions/seed-demo-data-phase3/index.ts` | Add super_admin auth + env guard |
| `supabase/functions/daily-data-seed/index.ts` | Add super_admin auth + env guard |

### Database Migration
- Update `calculate_payroll_for_run()` function with 2026 parameter defaults
- Insert 2026 payroll parameters for all existing tenants

---

## No Config Changes
`verify_jwt = false` remains in `config.toml` for these functions since they perform manual JWT/role validation internally (this is the established pattern in the codebase, as seen in `create-tenant`).


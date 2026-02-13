
# Comprehensive Compliance Recheck -- Gap Analysis (Updated)

## STATUS MATRIX

| # | Issue | Status |
|---|-------|--------|
| 1 | Chart of Accounts (Anglo-Saxon to Serbian) | ✅ FIXED |
| 2 | Invoice posting accounts (2040/6010/2470) | ✅ FIXED |
| 3 | POS journal entries + inventory | ✅ FIXED |
| 4 | Maloprodaja 1320/1329/1340 logic | ✅ FIXED — post_kalkulacija/post_nivelacija now split embedded VAT (1340) from margin (1329) |
| 5 | Payroll nontaxable = 34,221 RSD | ✅ FIXED |
| 6 | Payroll 6 contribution lines | ✅ FIXED |
| 7 | Payroll min/max contribution bases | ✅ FIXED — payroll_parameters table created with effective-dated min/max bases |
| 8-12 | Account codes (FixedAssets/Loans/Deferrals/FxReval/Kompenzacija) | ✅ FIXED |
| 13-19 | Edge Functions JWT auth | ✅ FIXED — all have getUser() in-code validation |
| 20 | web-order-import HMAC | ✅ FIXED |
| 21 | useTenant multi-tenant | ✅ FIXED |
| 22 | Kalkulacija/Nivelacija journal posting | ✅ FIXED |
| 23 | verify_jwt config.toml | ✅ N/A — platform requires verify_jwt=false with in-code validation |
| 24 | POS: posting before fiscalization | ✅ FIXED — fiscal-first state machine: pending_fiscal → fiscalized → posted |
| 25 | Invoice: "sent" = posted (SEF async) | ✅ FIXED — Model B: post + auto-SEF submit, retry on failure |
| 26 | SEF requestId idempotency | ✅ FIXED — sef_request_id column + requestId in payload |
| 27 | SEF async polling/reconciliation | PARTIAL — Manual retry via "Retry SEF" button. Background polling is future work. |
| 28 | Retail pricing embedded VAT | ✅ FIXED — account 1340 in post_kalkulacija/post_nivelacija |
| 29 | Payroll parameters table | ✅ FIXED — effective-dated table with RLS |
| 30 | eBolovanje integration | NOT IMPLEMENTED — requires RFZO API credentials |
| 31 | eOtpremnica compliance | PARTIAL — CRUD exists, no API submission (private sector Oct 2027) |
| 32 | fiscalize-receipt body bug | ✅ FIXED — added `const body = await req.json()` |
| 33 | Super admin audit trail | NOT IMPLEMENTED — enhancement |
| 34 | RLS permissive policy | PRE-EXISTING |
| 35 | Leaked password protection | PRE-EXISTING — auth setting |

## Remaining Future Work
- eBolovanje integration (RFZO API)
- eOtpremnica state API (MoF, mandatory Oct 2027 for private)
- SEF background polling/reconciliation job
- Super admin audit trail
- RLS permissive policy audit

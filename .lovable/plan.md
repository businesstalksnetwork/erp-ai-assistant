

# Upgrade Phases Implementation Plan

Implementing all items from the review **except #7** (Payroll 2026 Defaults — skipped per your instruction). Total: **32 items across 6 phases**.

---

## Phase 1: Critical Security and Data Integrity (Items 1-6)

### Item 1: Fix Account Code Validation (Class 5/6 Swapped)
**File:** New migration  
The current `validate_account_code_type()` function has Class 5 mapped to `revenue` and Class 6 to `expense`. Per Serbian accounting standards (Kontni Okvir), Class 5 = Rashodi (Expenses) and Class 6 = Prihodi (Revenue). The fix swaps these two mappings. Also run an audit query to detect any accounts created with the wrong type.

### Item 2: Enable JWT Verification
**File:** `supabase/config.toml`  
Remove all `verify_jwt = false` entries. Functions that need public access (webhooks, cron jobs) will validate auth internally via service role tokens. This affects all 67+ edge functions currently listed.

### Item 3: Add Auth Checks to Edge Functions
**Files:** ~25 edge function `index.ts` files  
Add `getUser()` check at the top of each function that handles user-initiated requests. Functions like `sef-*`, `import-*`, `send-*`, `track-invoice-view`, etc. will validate the Authorization header and return 401 if missing. Cron/webhook functions will check for a service-role or shared secret header instead.

### Item 4: Add .env to .gitignore
**File:** `.gitignore`  
Add `.env` and `.env.*` patterns to prevent credential leakage.

### Item 5: Block UNION in AI SQL + Parameterize Queries
**File:** `supabase/functions/ai-assistant/index.ts`  
- Add `"UNION "` to the `forbidden` keywords list in `validateSql()`
- Refactor `searchDocuments()`, `getPartnerDossier()`, and `explainAccount()` to use parameterized queries instead of string interpolation (replace `'${value}'` patterns with proper escaping or direct Supabase `.from()` queries)

### Item 6: Add Suspense to Super Admin Routes
**File:** `src/App.tsx`  
Wrap the super admin lazy-loaded routes (lines 78-84) inside `<Suspense fallback={<LoadingFallback />}>` — they currently use `React.lazy()` but have no `<Suspense>` boundary, which will crash if the chunk fails to load.

---

## Phase 2: Serbian 2026 Compliance (Items 8-14, skipping 7)

### Item 8: Advance Payment Settlement
**File:** New migration  
Create `settle_advance_payment()` RPC that:
- Takes `p_tenant_id`, `p_advance_id`, `p_invoice_id`, `p_tax_rate` (not hardcoded 20%)
- Creates a reversal journal entry offsetting the advance
- Updates both the advance payment record and invoice balance
- Handles partial settlements

### Item 9: Credit Note SEF Submission (Type 381)
**File:** `supabase/functions/sef-submit/index.ts`  
- Accept `document_type` parameter (default `380` for invoice, `381` for credit note)
- Add `<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>` for credit notes
- Add `<cac:BillingReference>` block referencing the original invoice
- Handle negative line amounts

### Item 10: SEF Tax Category Date Logic
**File:** `supabase/functions/sef-submit/index.ts`  
Update `getTaxCategoryId()` to accept an `invoiceDate` parameter. If date is before 2026-04-01, return legacy codes (`S`, `AE`). After that date, return split codes (`S10`/`S20`, `AE10`/`AE20`).

### Item 11: POPDV Section 2.1 Validation
**File:** New component or existing PDV periods page  
Add a validation check that detects Class 77xx accounts (financial income — interest on deposits) and flags if Section 2.1 is missing from the POPDV submission.

### Item 12: Fiscal Receipt PFR v3 Fields
**File:** `supabase/functions/fiscalize-receipt/index.ts`  
Add fields: `environmentType`, `OmitQRCodeGen`, multi-label support. Add journal endpoint call (`/api/v3/invoices/journal`) for end-of-day reconciliation.

### Item 13: Bilans Uspeha/Stanja Consistency
**Files:** `src/pages/tenant/BilansUspeha.tsx`, `src/pages/tenant/BilansStanja.tsx`  
Verify and fix that report mappings use Class 5 = Rashodi, Class 6 = Prihodi (consistent with Item 1 fix).

### Item 14: Payroll Enhancements
**Files:** `src/pages/tenant/Payroll.tsx`, new migration  
Add: meal allowance (topli obrok), transport allowance (prevoz), configurable overtime multiplier, partial month proration, variable municipal tax rates per employee.

---

## Phase 3: Architecture and Code Quality (Items 15-20)

### Item 15: ErrorBoundary for All Routes
**Status:** Already done. `TenantLayout.tsx` already wraps `<Outlet />` in `<ErrorBoundary>` (line 515). No changes needed.

### Item 16: Vite Build Optimization
**File:** `vite.config.ts`  
Add `build.rollupOptions.manualChunks` to split:
- `vendor`: react, react-dom, react-router-dom
- `charts`: recharts
- `ui`: radix-ui components
- `supabase`: @supabase/supabase-js

### Item 17: TypeScript Strict Mode
**File:** `tsconfig.app.json`  
Enable `noImplicitAny: true` first. Fix resulting type errors across the codebase module by module.

### Item 18: Prompt Injection Hardening
**File:** `supabase/functions/ai-assistant/index.ts`  
Add to `INJECTION_PATTERNS`: Unicode/homoglyph detection, base64-encoded instruction detection, canary tokens, and JSON injection blocking in tool argument parsing.

### Item 19: POS Offline Service Worker
**File:** `public/sw.js`  
Extend beyond push notifications. Add: offline caching strategy for POS terminal page assets, IndexedDB queue for offline transactions, sync-on-reconnect logic.

### Item 20: Cmd+K Command Palette
**Status:** Already done. `GlobalSearch` component using `cmdk` is already wired up in `TenantLayout.tsx` (line 537) with Ctrl/Cmd+K shortcut. No changes needed.

---

## Phase 4: Accounting Feature Gaps (Items 21-24)

### Item 21: Bank Reconciliation Auto-Match
**Files:** New edge function + new component  
Build matching algorithm that:
- Matches bank statement lines to invoices/open items by amount, reference number, and date proximity
- Scores matches with confidence levels (exact, partial, fuzzy)
- Presents unmatched items for manual reconciliation

### Item 22: Opening Balance Journal Entry
**File:** New migration (RPC function)  
Create `generate_opening_balance()` RPC that:
- Reads closing balances from the last posted fiscal period
- Creates a single journal entry with all balance sheet accounts
- Nets income/expense accounts into retained earnings (Class 340)

### Item 23: FX Revaluation Journal Entry
**File:** `src/pages/tenant/FxRevaluation.tsx` + new RPC  
Build backend logic to:
- Find all open items in foreign currencies
- Calculate unrealized gains/losses against current NBS exchange rates
- Create adjustment journal entries (Class 563/663)

### Item 24: IOS for Kompenzacija
**Files:** `src/pages/tenant/Kompenzacija.tsx`, `supabase/functions/generate-pdf/index.ts`  
Generate IOS (Izvod Otvorenih Stavki) document from kompenzacija records. Add PDF template for partner confirmation export.

---

## Phase 5: WMS, Production, and AI (Items 25-31)

### Item 25: WMS Pick Path Optimization
**File:** `supabase/functions/wms-slotting/index.ts` or new function  
Implement nearest-neighbor TSP heuristic for optimal pick sequences within warehouse zones.

### Item 26: WMS AI Put-Away Suggestions
**File:** New edge function `wms-putaway-suggest/index.ts`  
Suggest optimal bin locations based on product velocity (ABC analysis), product affinity, and zone rules.

### Item 27: WMS Mobile Picking with Barcode
**File:** New page `src/pages/tenant/WmsMobilePicking.tsx`  
Mobile-first picking interface using device camera for barcode/QR scanning via Web API.

### Item 28: Full MRP Engine (EOQ)
**File:** `src/pages/tenant/MrpEngine.tsx` + new RPC  
Extend MRP with gross/net requirements, Economic Order Quantity calculation, and auto-generated purchase requisitions.

### Item 29: Machine Capacity Model
**Files:** New migration + new page  
Create `production_resources` table and capacity planning logic for production scheduling against machine/labor availability.

### Item 30: AI Write Actions
**File:** `supabase/functions/ai-assistant/index.ts`  
Add `create_draft_entry` tool that creates draft journal entries, invoices, or purchase orders from conversation context. All created as "draft" status requiring manual approval.

### Item 31: Virtualized Tables
**Files:** Components with large data tables  
Add react-window or similar virtual scrolling for tables exceeding 1000 rows (partners list, inventory stock, journal entries).

---

## Phase 6: Housekeeping (Items 32-33)

### Item 32: Migration Consolidation
Create a single baseline schema migration representing current state. Archive 204 individual migration files. Adopt `YYYYMMDD_description.sql` naming convention.

### Item 33: Quality Predictor + Cost Variance Auto-JE
**Files:** `src/pages/tenant/QualityControl.tsx`, new RPC  
Add defect probability model based on historical quality check data. Auto-generate cost variance journal entries when production orders complete.

---

## Implementation Order

Phases will be implemented sequentially (1 through 6). Items 15 and 20 are already complete and will be skipped. This gives us **30 actionable items** to implement.


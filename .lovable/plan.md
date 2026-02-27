

# v2.1 / v2.2 / v2.3 Implementation Plan

This is a large scope (~30 items across 3 versions). I recommend tackling them in priority order across multiple implementation rounds.

---

## Round 1 — v2.1 "Compliance" (8 items, P0–P2)

### 1. efaktura_category per-line → UBL XML (P0)
Already done. `sef-submit/index.ts` reads `line.efaktura_category` at lines 124–125 and 160 — it's used in both `TaxSubtotal` and `ClassifiedTaxCategory`. **No work needed.**

### 2. SEF PIB validation before submission (P0)
Already done. `sef-submit/index.ts` lines 482–493 query `sef_registry` and return `pib_warning`. **No work needed.**

### 3. Encrypt SEF API keys at rest — pgcrypto (P1)
- Migration: `CREATE EXTENSION IF NOT EXISTS pgcrypto`; add `api_key_hmac` column to `sef_connections`; create encrypt/decrypt helper functions using `pgp_sym_encrypt`/`pgp_sym_decrypt` with a server-side secret
- Update `sef-submit` to decrypt key before API call
- Update Integrations UI to encrypt on save

### 4. eOtpremnica — real Ministry endpoint (P0)
- XML generation is complete in `eotpremnica-submit`
- Update to use `connection.api_url_encrypted` after decryption (post-pgcrypto)
- Add proper error mapping for Ministry responses
- Currently falls back to storing XML for manual download — keep that as fallback

### 5. eBolovanje — real RFZO/eUprava endpoint (P1)
- XML generation is complete in `ebolovanje-submit`
- Similar pattern to #4: decrypt credentials, call real eUprava URL, map response
- Leave request bridge already works

### 6. FIFO consume_fifo_layers in POS + invoice posting (P0)
- POS already calls `consume_fifo_layers` (PosTerminal.tsx line 349)
- Wire into `InvoiceForm.tsx` on post/finalize: after GL posting, call `consume_fifo_layers` for each line with a `product_id`
- Add same call in Returns flow for negative quantities (stock restoration)

### 7. 4-digit minimum account code CHECK constraint (P1)
- Migration: `ALTER TABLE chart_of_accounts ADD CONSTRAINT chk_code_min_4 CHECK (char_length(code) >= 4)`
- Add client-side validation in ChartOfAccounts form

### 8. Payroll rate change history table (P2)
- Migration: create `payroll_rate_history` table (id, tenant_id, employee_id, rate_type, old_value, new_value, effective_date, changed_by, created_at) with RLS
- Add trigger on `employee_salaries` to auto-log changes
- Display history in EmployeeDetail salary tab

---

## Round 2 — v2.2 "Foundation" (10 items)

### 9. Fix GlobalSearch dead links + module tags
- Audit all ~170 items in `GlobalSearch.tsx` against router definitions
- Add missing routes (e.g., fleet, WMS dashboard, payroll sub-pages)
- Add `module` tags to items that lack them
- Fix partners link (currently `/crm/partners` — verify route exists)

### 10. Add ~50 orphaned routes to sidebar
- Cross-reference router file with `TenantLayout.tsx` nav arrays
- Add missing items to appropriate nav groups (accounting, hr, settings, etc.)

### 11. Breadcrumb audit + UUID entity name display
- Audit `Breadcrumbs.tsx` — ensure detail pages show entity name instead of UUID
- Add data-fetching in breadcrumb for routes like `/crm/companies/:id`

### 12. Keyboard shortcuts expansion
- Extend `useKeyboardShortcuts` with new bindings (N=new, E=edit, S=save, Esc=cancel)
- Add shortcuts overlay (Shift+?)

### 13. Settings sidebar grouping (collapsible sections)
- Already using collapsible nav groups with `section` property
- Verify all settings items have proper `section` keys
- Add sub-page grouping where missing

### 14. Tenant Profile enhancements
- Add fields: PIB display, MB (maticni broj), seal/stamp upload (storage bucket)
- Update `TenantProfile.tsx` form and DB columns

### 15. Integration health check dashboard
- New component showing connection status for SEF, eBolovanje, eOtpremnica, NBS
- Query `*_connections` tables, show last_sync_at, last_error, is_active

### 16. Migrate raw Table → ResponsiveTable (~30 pages)
- 18 pages already migrated; systematically convert remaining pages
- Batch: JournalEntries, GeneralLedger, BankStatements, Partners, Leads, Opportunities, FixedAssets, Deferrals, Loans, CashRegister, etc.

### 17. Build ConfirmDialog + EntitySelector shared components
- `ConfirmDialog`: wraps AlertDialog with title/description/confirm/cancel props
- `EntitySelector`: generic combobox for selecting partners, employees, products, legal entities — replaces ad-hoc Select patterns

### 18. Performance optimizations
- Verify staleTime on all reference queries (already 5min on globals)
- Add `React.lazy` for chart-heavy pages (Analytics, Reports)
- Review Vite `manualChunks` config for new vendor splits

---

## Round 3 — v2.3 "Modules I" (selected P1–P2 items)

### 19. Travel Orders (Putni Nalozi) — full module (P1)
- DB: `travel_orders` + `travel_order_expenses` tables
- UI: list page, form (employee, destination, dates, per-diem calc, advance amount)
- GL posting integration via posting rules engine
- Serbian legal format (Putni Nalog template)

### 20. PK-1 Book, PPP-PO, OD-O, M4, ZPPPDV, Notes to FS (P1-P2)
- PK-1: Cash book summary report (query cash register transactions, format per regulations)
- PPP-PO: Annual income certificate XML/PDF
- OD-O/M4: Pension fund reporting
- Each is a report page + optional XML export edge function

### 21. Direct invoice stock deduction (P2)
- Extends FIFO work from #6 — auto-deduct on invoice finalization
- Add toggle in Settings for automatic vs. manual deduction

### 22. IFRS reporting formats (P2)
- Add IFRS-format templates for Balance Sheet and Income Statement
- IFRS 16 lease integration (link to existing LeaseContracts)
- IFRS 15 revenue recognition deferrals

### 23. Data protection enhancements (P2)
- Retention policy engine (auto-flag records past retention period)
- Breach notification workflow
- Data portability export (JSON/CSV per GDPR/ZZPL)

### 24. Sales upgrades (P2)
- Lead-to-partner conversion flow
- Quote → Sales Order → Invoice chain
- Discount approval workflow integration

### 25. Supplier evaluation + demand forecasting (P3)
- Supplier scorecard (delivery time, quality, price variance)
- Basic demand forecast using historical sales data

---

## Technical Details

### Database Migrations Required
1. `pgcrypto` extension + encrypt/decrypt functions for API keys
2. `payroll_rate_history` table with RLS
3. `chart_of_accounts` CHECK constraint (4-digit minimum)
4. `travel_orders` + `travel_order_expenses` tables (Round 3)

### Edge Functions to Modify
- `sef-submit`: decrypt API key before use
- `eotpremnica-submit`: wire real Ministry endpoint
- `ebolovanje-submit`: wire real eUprava endpoint

### New Shared Components
- `src/components/shared/ConfirmDialog.tsx`
- `src/components/shared/EntitySelector.tsx`

### Estimated Effort
- Round 1 (v2.1): ~6 implementation messages
- Round 2 (v2.2): ~8 implementation messages
- Round 3 (v2.3): ~10+ implementation messages

Items #1, #2 are already complete. Recommend starting Round 1 with items #3–#8.




## Phase 3: Fix 15 MEDIUM Bugs

After thorough codebase verification, here are the confirmed medium-severity issues and fixes.

### Bug 1: CR-MED-1 — POS `total_amount` sent to fiscalize-receipt adds tax on top of inclusive price

**Files:** `src/pages/tenant/PosTerminal.tsx` lines 303, 425

The sale/refund body correctly extracts tax from inclusive prices for `subtotal`/`tax_amount`/`total`, but the per-item `total_amount` sent to `fiscalize-receipt` still uses the old additive formula:
```
total_amount: c.unit_price * c.quantity * (1 + c.tax_rate / 100)
```
Since `unit_price` is already PDV-inclusive, this inflates each line item by 20%.

**Fix:** Change to `total_amount: c.unit_price * c.quantity` (price is already inclusive). Apply in both sale (line 425) and refund (line 303) fiscalization payloads.

### Bug 2: CR-MED-2 — POS hardcodes tax_rate: 20 for all products

**File:** `src/pages/tenant/PosTerminal.tsx` line 188

`addToCart` always sets `tax_rate: 20` regardless of the product's actual tax rate. Products with 10% or 0% rates get wrong tax calculations.

**Fix:** Look up the product's associated `tax_rate` from the product record or a joined tax_rates table. Fall back to 20 only if not found.

### Bug 3: CR-MED-3 — CreditDebitNotes GL posting missing legalEntityId

**File:** `src/pages/tenant/CreditDebitNotes.tsx` lines 137-147, 172-183

Both `postWithRuleOrFallback` calls omit `legalEntityId` even though the form has `legal_entity_id`. Multi-entity tenants get unfiltered journal entries.

**Fix:** Add `legalEntityId: f.legal_entity_id || undefined` to both credit note and debit note postings.

### Bug 4: CR-MED-4 — AssetDepreciation GL posting missing legalEntityId

**File:** `src/pages/tenant/AssetDepreciation.tsx` lines 101-111

`postWithRuleOrFallback` for depreciation entries omits `legalEntityId`. Assets may belong to specific legal entities.

**Fix:** Pass `legalEntityId: asset.legal_entity_id || undefined` to the posting call.

### Bug 5: CR-MED-5 — FxRevaluation GL posting missing legalEntityId

**File:** `src/pages/tenant/FxRevaluation.tsx` lines 214-224

`postWithRuleOrFallback` for FX revaluation omits `legalEntityId` even though the component already filters by `legalEntityFilter`.

**Fix:** Add `legalEntityId: legalEntityFilter !== "__all__" ? legalEntityFilter : undefined` to the posting call.

### Bug 6: CR-MED-6 — CreditDebitNotes credit note GL ignores VAT (same as Returns bug)

**File:** `src/pages/tenant/CreditDebitNotes.tsx` lines 143-146

Fallback lines only reverse revenue (6000) and AR (2040) without a VAT line. This is the same pattern as CR-HIGH-1 but in the standalone credit/debit notes page.

**Fix:** Add a VAT reversal line to the fallback, splitting `f.amount` into net and tax components based on the linked invoice's tax rate, or add a `tax_amount` input field similar to what was done in Returns.tsx.

### Bug 7: CR-MED-7 — POS stock deduction failures silently swallowed

**File:** `src/pages/tenant/PosTerminal.tsx` lines 474-488

Both FIFO consumption and stock deduction use `console.warn` and continue. After a fiscalized receipt, if stock deduction fails, inventory becomes out of sync with no user notification (only a console warning).

**Fix:** After the loop, if any stock errors occurred, show a toast warning to the user (don't block since receipt is already fiscalized, but make it visible).

### Bug 8: CR-MED-8 — Missing database indexes on high-query tables

Several frequently-queried columns lack composite indexes:
- `pos_transactions(tenant_id, receipt_type, status)` — used by refund queries and daily reports
- `credit_notes(tenant_id, invoice_id)` — used by credit note lookups  
- `debit_notes(tenant_id, invoice_id)` — same pattern
- `employees(tenant_id, is_active)` — very frequent HR queries
- `payroll_runs(tenant_id, status)` — payroll list filtering

**Fix:** Add a migration with these 5 composite indexes.

### Bug 9: CR-MED-9 — Kompenzacija GL posting missing legalEntityId

**File:** `src/pages/tenant/Kompenzacija.tsx` line 97-101

`postWithRuleOrFallback` for compensation entries omits `legalEntityId`.

**Fix:** Pass the selected legal entity to the posting call.

### Bug 10: CR-MED-10 — TravelOrderForm GL posting missing legalEntityId

**File:** `src/pages/tenant/TravelOrderForm.tsx` around line 200

`postWithRuleOrFallback` for travel order settlement omits `legalEntityId`.

**Fix:** Pass legal entity from travel order record.

### Bug 11: CR-MED-11 — WorkLogsBulkEntry and WorkLogsCalendar are dead redirect components

**Files:** `src/pages/tenant/WorkLogsBulkEntry.tsx`, `src/pages/tenant/WorkLogsCalendar.tsx`

These components just `<Navigate>` to `/hr/work-logs?tab=...`. They're loaded lazily via route config but serve no purpose since the same tab switching can be done in-page.

**Fix:** Remove these redirect components and their route entries from `hrRoutes.tsx`. Update any navigation links to point directly to `/hr/work-logs?tab=bulk` or `?tab=calendar`.

### Bug 12: CR-MED-12 — JournalEntries date input has no validation against fiscal period

**File:** `src/pages/tenant/JournalEntries.tsx` line 105

The journal entry form allows any date, including dates in closed fiscal periods. The RPC `create_journal_entry_with_lines` may reject it, but the error message is opaque.

**Fix:** Add a pre-check using `checkFiscalPeriodOpen` before posting, with a clear user-facing error message if the period is closed.

### Bug 13: CR-MED-13 — AssetInventoryCountDetail GL posting missing legalEntityId

**File:** `src/pages/tenant/AssetInventoryCountDetail.tsx` line 153

Same missing `legalEntityId` pattern.

**Fix:** Pass legal entity from count record.

### Bug 14: CR-MED-14 — SupplierInvoices GL posting missing legalEntityId

**File:** `src/pages/tenant/SupplierInvoices.tsx` lines 206, 247

Both invoice posting and payment posting omit `legalEntityId` even though the form stores it.

**Fix:** Pass `legalEntityId: inv.legal_entity_id || undefined` to both calls.

### Bug 15: CR-MED-15 — PAYROLL_PAYMENT missing from postingRuleEngine PAYMENT_MODEL_KEYS

**File:** `src/lib/postingRuleEngine.ts` line 126

The `PAYMENT_MODEL_KEYS` map has `PAYROLL_NET` and `PAYROLL_TAX` but no `PAYROLL_PAYMENT` entry, meaning the posting rules UI won't show it as a configurable model.

**Fix:** Add `PAYROLL_PAYMENT: "payrollPayment"` to the map, and add translation keys for both languages.

### Execution Order
1. Database migration: Add 5 composite indexes (Bug 8)
2. POS fixes: Bugs 1, 2, 7 — `PosTerminal.tsx`
3. Missing legalEntityId across 6 posting pages: Bugs 3, 4, 5, 9, 10, 13, 14
4. CreditDebitNotes VAT fix: Bug 6
5. Dead code removal: Bug 11
6. Journal date validation: Bug 12
7. Posting rule engine key: Bug 15

### Files Modified
| File | Bugs |
|------|------|
| `src/pages/tenant/PosTerminal.tsx` | 1, 2, 7 |
| `src/pages/tenant/CreditDebitNotes.tsx` | 3, 6 |
| `src/pages/tenant/AssetDepreciation.tsx` | 4 |
| `src/pages/tenant/FxRevaluation.tsx` | 5 |
| `src/pages/tenant/Kompenzacija.tsx` | 9 |
| `src/pages/tenant/TravelOrderForm.tsx` | 10 |
| `src/pages/tenant/WorkLogsBulkEntry.tsx` | 11 (delete) |
| `src/pages/tenant/WorkLogsCalendar.tsx` | 11 (delete) |
| `src/routes/hrRoutes.tsx` | 11 |
| `src/pages/tenant/JournalEntries.tsx` | 12 |
| `src/pages/tenant/AssetInventoryCountDetail.tsx` | 13 |
| `src/pages/tenant/SupplierInvoices.tsx` | 14 |
| `src/lib/postingRuleEngine.ts` | 15 |
| `src/i18n/translations.ts` | 15 |
| 1 database migration | 8 |


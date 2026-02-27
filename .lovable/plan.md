

## v2.5 — POS Fiscalization PRD: 7 Gaps Fix

Implementing all 4 phases from the PRD across 7 identified gaps.

### Phase 1: Critical Legal Fixes (P0)

**GAP 7 — Refund sends wrong referent number**
- `PosTerminal.tsx` line 231: change `selectedOriginalTx.transaction_number` → `selectedOriginalTx.fiscal_receipt_number`
- Add validation before refund: if original tx has no `fiscal_receipt_number`, block refund with error message
- Add `referent_receipt_date` from original tx `created_at`
- Update `recentTransactions` query (line 123-124) to also SELECT `fiscal_receipt_number`
- Show fiscal receipt number in refund dialog header for operator verification

**GAP 6 — No PFR-signed Z-report**
- DB migration: add `pfr_journal_response JSONB` + `pfr_journal_fetched_at TIMESTAMPTZ` to `pos_daily_reports`
- `PosDailyReport.tsx`: add "Fiskalni Z-report" button that calls `fiscalize-receipt` with `journal_report: { date_from, date_to }`
- Store PFR journal response in `pos_daily_reports.pfr_journal_response`
- Display PFR journal data alongside software report with discrepancy highlighting

**GAP 2 — Event bus POS stubs**
- `process-module-event/index.ts`: replace stub handlers for `pos.transaction_completed` with comments indicating direct handling by PosTerminal

### Phase 2: Cash Register Bridge (P1)

**GAP 3 — CashRegister disconnected from POS**
- DB migration: add `pos_transaction_id UUID REFERENCES pos_transactions(id)` + `source TEXT NOT NULL DEFAULT 'manual'` to `cash_register`, with unique index on `pos_transaction_id`
- `PosTerminal.tsx` `completeSale`: after fiscalization of cash sales, INSERT into `cash_register` (direction: 'in', source: 'pos', no journal_entry_id since `process_pos_sale` already handles GL)
- `PosTerminal.tsx` `processRefund`: after fiscalization of cash refunds, INSERT into `cash_register` (direction: 'out', source: 'pos')
- `CashRegister.tsx`: add source filter tabs (All/Manual/POS), show "POS" badge on auto-generated entries, make POS entries read-only

### Phase 3: Session & Device Binding (P1)

**GAP 1 — `pos_sessions.fiscal_device_id` never set**
- `PosSessions.tsx`: add fiscal device selector in open session dialog, auto-select if location has 1 device, warning if none
- `PosSessions.tsx` `openSession`: include `fiscal_device_id` in INSERT
- `PosTerminal.tsx`: read `activeSession.fiscal_device_id` first, fallback to location query

**GAP 5 — Daily report missing `fiscal_device_id`**
- `PosDailyReport.tsx` `generateReport`: resolve `fiscal_device_id` from session data and include in INSERT

### Phase 4: CRM Buyer Linkage (P2)

**GAP 4 — `buyer_id` is free-text, no FK**
- DB migration: add `buyer_partner_id UUID REFERENCES partners(id)` to `pos_transactions`
- `PosTerminal.tsx`: add optional partner EntitySelector; when partner selected, auto-fill `buyer_id` with partner PIB and set `buyer_partner_id`

### Database Migration (single combined)

```sql
-- Phase 1: PFR Z-report storage
ALTER TABLE pos_daily_reports
  ADD COLUMN IF NOT EXISTS pfr_journal_response JSONB,
  ADD COLUMN IF NOT EXISTS pfr_journal_fetched_at TIMESTAMPTZ;

-- Phase 2: Cash register POS bridge
ALTER TABLE cash_register
  ADD COLUMN IF NOT EXISTS pos_transaction_id UUID REFERENCES pos_transactions(id),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_register_pos_tx_unique
  ON cash_register(pos_transaction_id) WHERE pos_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_register_source
  ON cash_register(source, tenant_id);

-- Phase 4: Buyer partner linkage
ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS buyer_partner_id UUID REFERENCES partners(id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_buyer_partner
  ON pos_transactions(buyer_partner_id) WHERE buyer_partner_id IS NOT NULL;
```

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/tenant/PosTerminal.tsx` | GAP 7 fix (refund ref), GAP 3 (cash bridge), GAP 1 (session device), GAP 4 (buyer partner) |
| `src/pages/tenant/PosSessions.tsx` | GAP 1 (device selector in open dialog) |
| `src/pages/tenant/PosDailyReport.tsx` | GAP 6 (PFR Z-report), GAP 5 (device_id in report) |
| `src/pages/tenant/CashRegister.tsx` | GAP 3 (source filter, POS badge, read-only) |
| `supabase/functions/process-module-event/index.ts` | GAP 2 (remove stubs) |
| `src/i18n/translations.ts` | New keys for Z-report, POS source, buyer partner |
| Migration SQL | 3 ALTER TABLE + indexes |


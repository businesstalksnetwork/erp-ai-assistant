

## v2.5 — POS Fiscalization PRD: 7 Gaps Fix ✅ COMPLETED

All 4 phases implemented across 7 identified gaps.

### Phase 1: Critical Legal Fixes (P0) ✅
- **GAP 7** — Refund now uses `fiscal_receipt_number` instead of `transaction_number`, blocks refund if missing
- **GAP 6** — PFR Z-report button added to PosDailyReport with `fiscalize-receipt` journal integration
- **GAP 2** — Event bus POS stubs replaced with skip comments indicating direct PosTerminal handling

### Phase 2: Cash Register Bridge (P1) ✅
- **GAP 3** — POS cash sales/refunds auto-insert into `cash_register` with `source: 'pos'`, source filter tabs added

### Phase 3: Session & Device Binding (P1) ✅
- **GAP 1** — Fiscal device selector in open session dialog, auto-select if single device
- **GAP 5** — Daily report resolves `fiscal_device_id` from session data

### Phase 4: CRM Buyer Linkage (P2) ✅
- **GAP 4** — Partner EntitySelector in POS cart, auto-fills buyer_id with PIB, stores `buyer_partner_id`

### Database Migration ✅
- `pos_daily_reports`: `pfr_journal_response`, `pfr_journal_fetched_at`
- `cash_register`: `pos_transaction_id`, `source`
- `pos_transactions`: `buyer_partner_id`

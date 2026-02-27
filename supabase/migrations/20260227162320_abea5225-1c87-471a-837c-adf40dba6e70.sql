
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

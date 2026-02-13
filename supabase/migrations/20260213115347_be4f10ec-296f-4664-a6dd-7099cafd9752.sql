
-- Add status column to pos_transactions for fiscal state machine
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_fiscal';

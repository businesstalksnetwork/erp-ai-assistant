
-- =============================================
-- Step 3: Voucher PDV Treatment
-- Add voucher_type to invoices and pos_transactions
-- =============================================

-- Add voucher_type to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voucher_type TEXT CHECK (voucher_type IS NULL OR voucher_type IN ('single_purpose', 'multi_purpose'));

-- Add voucher_type to pos_transactions
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS voucher_type TEXT CHECK (voucher_type IS NULL OR voucher_type IN ('single_purpose', 'multi_purpose'));

-- Add voucher_original_receipt_id for redemption linking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voucher_original_invoice_id UUID REFERENCES public.invoices(id);
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS voucher_original_transaction_id UUID REFERENCES public.pos_transactions(id);


ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS goods_receipt_id uuid REFERENCES public.goods_receipts(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid REFERENCES public.supplier_invoices(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS drive_folder_id uuid REFERENCES public.drive_folders(id);

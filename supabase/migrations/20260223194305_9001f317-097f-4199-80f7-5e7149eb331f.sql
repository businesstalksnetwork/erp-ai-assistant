
-- Auto-create open_items when invoice status changes to 'sent' or 'posted'
-- Auto-close open_items when invoice status changes to 'paid'
CREATE OR REPLACE FUNCTION public.auto_sync_open_items_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-create open_item when invoice is sent/posted (and doesn't exist yet)
  IF NEW.status IN ('sent', 'posted', 'overdue') AND (OLD.status IS NULL OR OLD.status NOT IN ('sent', 'posted', 'overdue')) THEN
    INSERT INTO public.open_items (tenant_id, partner_id, document_type, document_id, document_number, document_date, due_date, currency, original_amount, paid_amount, remaining_amount, direction, status)
    VALUES (NEW.tenant_id, NEW.partner_id, 'invoice', NEW.id, NEW.invoice_number, NEW.invoice_date, NEW.due_date, NEW.currency, NEW.total, 0, NEW.total, 'receivable', 'open')
    ON CONFLICT (tenant_id, document_type, document_id) DO NOTHING;
  END IF;

  -- Auto-close open_item when invoice is marked as paid
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE public.open_items
    SET status = 'closed', paid_amount = original_amount, remaining_amount = 0, closed_at = now()
    WHERE document_id = NEW.id AND document_type = 'invoice' AND tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Auto-create open_items for supplier invoices
CREATE OR REPLACE FUNCTION public.auto_sync_open_items_supplier_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-create when received/approved
  IF NEW.status IN ('received', 'approved') AND (OLD.status IS NULL OR OLD.status NOT IN ('received', 'approved')) THEN
    INSERT INTO public.open_items (tenant_id, partner_id, document_type, document_id, document_number, document_date, due_date, currency, original_amount, paid_amount, remaining_amount, direction, status)
    VALUES (NEW.tenant_id, NEW.supplier_id, 'supplier_invoice', NEW.id, NEW.invoice_number, NEW.invoice_date, NEW.due_date, NEW.currency, NEW.total, 0, NEW.total, 'payable', 'open')
    ON CONFLICT (tenant_id, document_type, document_id) DO NOTHING;
  END IF;

  -- Auto-close when paid
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE public.open_items
    SET status = 'closed', paid_amount = original_amount, remaining_amount = 0, closed_at = now()
    WHERE document_id = NEW.id AND document_type = 'supplier_invoice' AND tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Add unique constraint for conflict handling (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_items_tenant_doctype_docid_key'
  ) THEN
    ALTER TABLE public.open_items ADD CONSTRAINT open_items_tenant_doctype_docid_key UNIQUE (tenant_id, document_type, document_id);
  END IF;
END $$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_auto_open_items_invoice ON public.invoices;
CREATE TRIGGER trg_auto_open_items_invoice
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_open_items_invoice();

DROP TRIGGER IF EXISTS trg_auto_open_items_supplier_invoice ON public.supplier_invoices;
CREATE TRIGGER trg_auto_open_items_supplier_invoice
  AFTER UPDATE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_open_items_supplier_invoice();

-- Also add legal_entity_id to deferrals if not exists
ALTER TABLE public.deferrals ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);

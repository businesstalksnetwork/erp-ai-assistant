
-- Fix broken trigger: add missing sef_invoice_id column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sef_invoice_id TEXT;

-- 1. popdv_tax_types reference table
CREATE TABLE public.popdv_tax_types (
  id TEXT PRIMARY KEY,
  description_short TEXT NOT NULL,
  description_long TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('OUTPUT', 'INPUT', 'BOTH')),
  popdv_section INTEGER NOT NULL,
  parent_id TEXT REFERENCES public.popdv_tax_types(id),
  is_special_record BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  law_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.popdv_tax_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popdv_tax_types_read_all" ON public.popdv_tax_types FOR SELECT USING (true);

-- 2. Seed all POPDV types
INSERT INTO public.popdv_tax_types (id, description_short, direction, popdv_section, sort_order, is_special_record) VALUES
('1.1', 'Promet dobara koja se otpremaju u inostranstvo', 'OUTPUT', 1, 100, false),
('1.2', 'Promet dobara koja se unose u slobodnu zonu', 'OUTPUT', 1, 200, false),
('1.3', 'Promet usluga u inostranstvu', 'OUTPUT', 1, 300, false),
('1.4', 'Promet usluga povezanih sa uvozom', 'OUTPUT', 1, 400, false),
('1.5', 'Ostali promet sa pravom na odbitak', 'OUTPUT', 1, 500, false),
('2.1', 'Promet u okviru delatnosti oslobođene PDV', 'OUTPUT', 2, 600, false),
('2.2', 'Promet nepokretnosti starijih od 2 godine', 'OUTPUT', 2, 700, false),
('2.3', 'Promet bez naknade bez prava na odbitak', 'OUTPUT', 2, 800, false),
('3.1', 'Promet dobara po opštoj stopi', 'OUTPUT', 3, 900, false),
('3.2', 'Promet usluga po opštoj stopi', 'OUTPUT', 3, 1000, false),
('3.3', 'Promet bez naknade po opštoj stopi', 'OUTPUT', 3, 1100, false),
('3.4', 'Povećanje osnovice po opštoj stopi', 'OUTPUT', 3, 1200, false),
('3.5', 'Smanjenje osnovice po opštoj stopi', 'OUTPUT', 3, 1300, false),
('3.6', 'Obračunati PDV po opštoj stopi', 'OUTPUT', 3, 1400, true),
('3.7', 'Avans po opštoj stopi', 'OUTPUT', 3, 1500, false),
('3a.1', 'Interni obračun - dobra opšta stopa', 'OUTPUT', 3, 1600, false),
('3a.2', 'Interni obračun - usluge opšta stopa', 'OUTPUT', 3, 1700, false),
('3a.3', 'Interni obračun - PDV opšta stopa', 'OUTPUT', 3, 1800, true),
('4.1', 'Promet dobara po posebnoj stopi', 'OUTPUT', 4, 1900, false),
('4.1.2', 'Promet dobara po posebnoj stopi - uvoz', 'INPUT', 4, 1950, false),
('4.2', 'Promet usluga po posebnoj stopi', 'OUTPUT', 4, 2000, false),
('4.3', 'Promet bez naknade po posebnoj stopi', 'OUTPUT', 4, 2100, false),
('4.4', 'Povećanje osnovice po posebnoj stopi', 'OUTPUT', 4, 2200, false),
('4.5', 'Smanjenje osnovice po posebnoj stopi', 'OUTPUT', 4, 2300, false),
('4.6', 'Obračunati PDV po posebnoj stopi', 'OUTPUT', 4, 2400, true),
('4.7', 'Avans po posebnoj stopi', 'OUTPUT', 4, 2500, false),
('4a.1', 'Interni obračun - dobra posebna stopa', 'OUTPUT', 4, 2600, false),
('4a.2', 'Interni obračun - usluge posebna stopa', 'OUTPUT', 4, 2700, false),
('4a.3', 'Interni obračun - PDV posebna stopa', 'OUTPUT', 4, 2800, true),
('5.1', 'Ukupna osnovica opšta stopa', 'OUTPUT', 5, 2900, true),
('5.2', 'Ukupan PDV opšta stopa', 'OUTPUT', 5, 3000, true),
('5.3', 'Ukupna osnovica posebna stopa', 'OUTPUT', 5, 3100, true),
('5.4', 'Ukupan PDV posebna stopa', 'OUTPUT', 5, 3200, true),
('5.5', 'Ukupna osnovica interni obračun', 'OUTPUT', 5, 3300, true),
('5.6', 'Ukupan PDV interni obračun', 'OUTPUT', 5, 3400, true),
('5.7', 'Ukupan obračunati PDV', 'OUTPUT', 5, 3500, true),
('6.1', 'Prethodni PDV - nabavke opšta stopa', 'INPUT', 6, 3600, false),
('6.2', 'Prethodni PDV - nabavke posebna stopa', 'INPUT', 6, 3700, false),
('6.2.1', 'PDV plaćen pri uvozu - opšta stopa', 'INPUT', 6, 3800, false),
('6.2.2', 'PDV plaćen pri uvozu - posebna stopa', 'INPUT', 6, 3900, false),
('6.3', 'Ispravka prethodnog poreza - povećanje', 'INPUT', 6, 4000, false),
('6.4', 'Ispravka prethodnog poreza - smanjenje', 'INPUT', 6, 4100, false),
('6.5', 'Ukupan prethodni porez', 'INPUT', 6, 4200, true),
('7.1', 'PDV za usluge iz inostranstva - opšta', 'INPUT', 7, 4300, false),
('7.2', 'PDV za usluge iz inostranstva - posebna', 'INPUT', 7, 4400, false),
('7.3', 'Ukupan prethodni porez inostranstvo', 'INPUT', 7, 4500, true),
('8a.1', 'Nabavka dobara opšta stopa', 'INPUT', 8, 4600, false),
('8a.2', 'Nabavka dobara posebna stopa', 'INPUT', 8, 4700, false),
('8a.3', 'Nabavka usluga opšta stopa', 'INPUT', 8, 4800, false),
('8a.4', 'Nabavka usluga posebna stopa', 'INPUT', 8, 4900, false),
('8a.5', 'Nabavke oslobođene PDV', 'INPUT', 8, 5000, false),
('8b.1', 'Nabavka od poljoprivrednika - osnovica', 'INPUT', 8, 5100, false),
('8b.2', 'Nabavka od poljoprivrednika - PDV nadoknada', 'INPUT', 8, 5200, false),
('8v.1', 'Uvoz dobara - opšta stopa', 'INPUT', 8, 5300, false),
('8v.2', 'Uvoz dobara - posebna stopa', 'INPUT', 8, 5400, false),
('8v.3', 'Uvoz oslobođen PDV', 'INPUT', 8, 5500, false),
('8g.1', 'Nabavka od stranih lica - dobra opšta', 'INPUT', 8, 5600, false),
('8g.2', 'Nabavka od stranih lica - dobra posebna', 'INPUT', 8, 5700, false),
('8g.3', 'Nabavka od stranih lica - usluge opšta', 'INPUT', 8, 5800, false),
('8g.4', 'Nabavka od stranih lica - usluge posebna', 'INPUT', 8, 5900, false),
('8d.1', 'Promet drugog lica - obveznik obračunava PDV', 'INPUT', 8, 6000, false),
('8d.2', 'Ostale nabavke sa PDV', 'INPUT', 8, 6100, false),
('8dj.1', 'Ukupan prethodni porez', 'INPUT', 8, 6200, true),
('8e.1', 'Ispravka srazmernog odbitka', 'INPUT', 8, 6300, false),
('8e.2', 'Ispravka po osnovu izmene uslova', 'INPUT', 8, 6400, false),
('8e.3', 'Ukupna ispravka - povećanje', 'INPUT', 8, 6500, false),
('8e.4', 'Ukupna ispravka - smanjenje', 'INPUT', 8, 6600, false),
('8e.5', 'Ukupan prethodni porez za odbitak', 'INPUT', 8, 6700, true),
('9.1', 'PDV bez prava na odbitak', 'INPUT', 9, 6800, false),
('9.2', 'PDV za srazmerni odbitak', 'INPUT', 9, 6900, false),
('9.3', 'Ukupan neodbivi PDV', 'INPUT', 9, 7000, true),
('10.1', 'Poreska obaveza', 'BOTH', 10, 7100, true),
('11.1', 'Promet izvršen van RS', 'OUTPUT', 11, 7200, false),
('11.2', 'Promet za koji se ne plaća PDV', 'OUTPUT', 11, 7300, false),
('11.3', 'Promet ulaganja u objekte', 'OUTPUT', 11, 7400, false),
('11.4', 'Primljeni avans', 'OUTPUT', 11, 7500, false),
('11.5', 'Dati avans', 'INPUT', 11, 7600, false),
('11.6', 'Smanjenje obaveze za PDV', 'BOTH', 11, 7700, false),
('11.7', 'Povećanje obaveze za PDV', 'BOTH', 11, 7800, false),
('11.8', 'Uvoz bez PDV', 'INPUT', 11, 7900, false);

-- 3. vat_date columns
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_date DATE;
UPDATE public.invoices SET vat_date = invoice_date WHERE vat_date IS NULL;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS vat_date DATE;
UPDATE public.supplier_invoices SET vat_date = invoice_date::date WHERE vat_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_vat_date ON public.invoices(tenant_id, vat_date) WHERE vat_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_vat_date ON public.supplier_invoices(tenant_id, vat_date) WHERE vat_date IS NOT NULL;

-- 4. vat_non_deductible
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS vat_non_deductible NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_invoice_lines ADD COLUMN IF NOT EXISTS vat_non_deductible NUMERIC NOT NULL DEFAULT 0;

-- 5. fee_value
ALTER TABLE public.supplier_invoice_lines ADD COLUMN IF NOT EXISTS fee_value NUMERIC NOT NULL DEFAULT 0;

-- 6. Missing columns on supplier_invoice_lines
ALTER TABLE public.supplier_invoice_lines ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.supplier_invoice_lines ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);
ALTER TABLE public.supplier_invoice_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.supplier_invoice_lines sil
SET tenant_id = si.tenant_id
FROM public.supplier_invoices si
WHERE sil.supplier_invoice_id = si.id AND sil.tenant_id IS NULL;

-- 7. reverse_charge_entries
CREATE TABLE public.reverse_charge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id),
  supplier_invoice_line_id UUID NOT NULL REFERENCES public.supplier_invoice_lines(id),
  input_popdv_field TEXT NOT NULL,
  output_popdv_field TEXT NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  vat_date DATE NOT NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reverse_charge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reverse_charge_tenant_isolation" ON public.reverse_charge_entries
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_reverse_charge_vat_date ON public.reverse_charge_entries(tenant_id, vat_date);

-- 8. popdv_snapshots
CREATE TABLE public.popdv_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  pp_pdv_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, legal_entity_id, period_start, period_end)
);

ALTER TABLE public.popdv_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popdv_snapshots_tenant_isolation" ON public.popdv_snapshots
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Add missing unique constraints required by the legacy import upsert calls

-- Partners: unique PIB per tenant (partial index — only when PIB is not null)
CREATE UNIQUE INDEX IF NOT EXISTS partners_tenant_pib_key
  ON public.partners (tenant_id, pib) WHERE pib IS NOT NULL;

-- Products: unique SKU per tenant (partial index — only when SKU is not null)
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_key
  ON public.products (tenant_id, sku) WHERE sku IS NOT NULL;

-- Invoices: unique invoice_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_invoice_number_key
  ON public.invoices (tenant_id, invoice_number);

-- Warehouses: unique name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_tenant_name_key
  ON public.warehouses (tenant_id, name);

-- Tax rates: unique name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS tax_rates_tenant_name_key
  ON public.tax_rates (tenant_id, name);

-- Supplier invoices: unique invoice_number per tenant (used by importSupplierInvoices upsert)
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_tenant_invoice_number_key
  ON public.supplier_invoices (tenant_id, invoice_number);

-- Legal entities: unique name per tenant (used by importLegalEntities upsert)
CREATE UNIQUE INDEX IF NOT EXISTS legal_entities_tenant_name_key
  ON public.legal_entities (tenant_id, name);

-- =============================================
-- PHASE 1: Banks registry + enhanced bank_accounts
-- =============================================

CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  swift_code TEXT,
  bank_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'RS',
  email_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banks are readable by authenticated users"
  ON public.banks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE UNIQUE INDEX idx_banks_bank_code ON public.banks(bank_code);

INSERT INTO public.banks (name, swift_code, bank_code, country, email_domain) VALUES
  ('Banca Intesa', 'DBDBRSBG', '160', 'RS', 'bancaintesa.rs'),
  ('UniCredit Bank', 'BACXRSBG', '170', 'RS', 'unicreditgroup.rs'),
  ('Raiffeisen Bank', 'RABORSBG', '265', 'RS', 'raiffeisenbank.rs'),
  ('OTP Banka', 'OTPVRSBG', '325', 'RS', 'otpbanka.rs'),
  ('Addiko Bank', 'HAABORSBG', '125', 'RS', 'addiko.rs'),
  ('Erste Bank', 'GIBARS22', '340', 'RS', 'erstebank.rs'),
  ('ProCredit Bank', 'PRCBRSBG', '220', 'RS', 'procreditbank.rs'),
  ('Halkbank', 'CABORSBG', '155', 'RS', 'halkbank.rs'),
  ('Komercijalna Banka', 'KOBBRSBG', '205', 'RS', 'kombank.com'),
  ('AIK Banka', 'AIKBRSBG', '105', 'RS', 'aikbanka.rs'),
  ('NLB Banka', 'KONZRSBG', '310', 'RS', 'nlb.rs'),
  ('Eurobank Direktna', 'EUOCRSBG', '150', 'RS', 'eurobank.rs');

-- Add new columns to bank_accounts
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS swift_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS opening_date DATE,
  ADD COLUMN IF NOT EXISTS closing_date DATE,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES public.banks(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_bank_accounts_iban ON public.bank_accounts(iban) WHERE iban IS NOT NULL;

-- =============================================
-- PHASE 2: Document Import Pipeline
-- =============================================

CREATE TABLE public.document_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  source_type TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
  original_filename TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'CSV',
  file_size_bytes INTEGER,
  sha256_hash TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  parser_used TEXT,
  ocr_confidence_avg NUMERIC,
  transactions_count INTEGER DEFAULT 0,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  error_message TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view document imports"
  ON public.document_imports FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can insert document imports"
  ON public.document_imports FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can update document imports"
  ON public.document_imports FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE UNIQUE INDEX idx_document_imports_hash ON public.document_imports(tenant_id, sha256_hash) WHERE sha256_hash IS NOT NULL;

-- csv_import_profiles
CREATE TABLE public.csv_import_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  bank_id UUID REFERENCES public.banks(id),
  profile_name TEXT NOT NULL,
  separator TEXT NOT NULL DEFAULT ',',
  encoding TEXT NOT NULL DEFAULT 'UTF-8',
  header_row INTEGER NOT NULL DEFAULT 1,
  date_format TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
  decimal_separator TEXT NOT NULL DEFAULT ',',
  column_mappings JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.csv_import_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System profiles and tenant profiles are readable"
  ON public.csv_import_profiles FOR SELECT
  USING (is_system = true OR tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage their profiles"
  ON public.csv_import_profiles FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can update their profiles"
  ON public.csv_import_profiles FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- Seed default CSV profiles
INSERT INTO public.csv_import_profiles (bank_id, profile_name, separator, encoding, header_row, date_format, decimal_separator, column_mappings, is_system)
SELECT b.id, b.name || ' CSV', ';', 'Windows-1250', 1, 'DD.MM.YYYY', ',',
  '{"date":"Datum","amount":"Iznos","description":"Opis","reference":"Poziv na broj","partner_name":"Naziv","partner_account":"Račun"}'::jsonb,
  true
FROM public.banks b
WHERE b.bank_code IN ('160','170','265','325','340');

-- =============================================
-- PHASE 3: Enhanced bank_statement_lines
-- =============================================

ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS value_date DATE,
  ADD COLUMN IF NOT EXISTS counterparty_iban TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_bank TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS document_import_id UUID REFERENCES public.document_imports(id);

CREATE INDEX IF NOT EXISTS idx_bsl_document_import ON public.bank_statement_lines(document_import_id) WHERE document_import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bsl_match_status ON public.bank_statement_lines(match_status);


-- =============================================
-- P0: Extend payroll_payment_types with official columns
-- =============================================
ALTER TABLE public.payroll_payment_types 
  ADD COLUMN IF NOT EXISTS osnovna_tabela smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS satnica_tip text DEFAULT 'K',
  ADD COLUMN IF NOT EXISTS payment_category text DEFAULT 'Z',
  ADD COLUMN IF NOT EXISTS affects_m4 boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS compensation_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gl_debit text DEFAULT '5200',
  ADD COLUMN IF NOT EXISTS gl_credit text DEFAULT '4500',
  ADD COLUMN IF NOT EXISTS reduces_regular boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS includes_hot_meal boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_advance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_storno boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_benefit boolean DEFAULT false;

-- =============================================
-- P2: Create income_recipient_types reference table
-- =============================================
CREATE TABLE IF NOT EXISTS public.income_recipient_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.income_recipient_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipient types" ON public.income_recipient_types
  FOR SELECT USING (true);

-- Add recipient_type_code to employees
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS recipient_type_code text DEFAULT '01';

-- =============================================
-- P3: Create ovp_catalog reference table
-- =============================================
CREATE TABLE IF NOT EXISTS public.ovp_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ovp text NOT NULL,
  ola text NOT NULL DEFAULT '00',
  ben text NOT NULL DEFAULT '0',
  description text NOT NULL,
  income_source text NOT NULL DEFAULT 'employment',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ovp_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read OVP catalog" ON public.ovp_catalog
  FOR SELECT USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ovp_catalog_unique ON public.ovp_catalog(ovp, ola, ben);

-- =============================================
-- P1: Add missing subsidy columns to payroll_income_categories
-- =============================================
ALTER TABLE public.payroll_income_categories
  ADD COLUMN IF NOT EXISTS subsidy_unemployment_employee_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subsidy_unemployment_employer_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unemployment_employer_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- =============================================
-- Seed income_recipient_types (12 official codes)
-- =============================================
INSERT INTO public.income_recipient_types (code, name) VALUES
  ('01', 'Zaposleni'),
  ('02', 'Osnivač/član privrednog društva zaposlen u tom društvu'),
  ('03', 'Lice osigurano po osnovu samostalne delatnosti'),
  ('04', 'Lice osigurano po osnovu poljoprivredne delatnosti'),
  ('05', 'Lice koje nije osigurano po drugom osnovu'),
  ('06', 'Nerezident'),
  ('07', 'Invalidno lice'),
  ('08', 'Vojni osiguranik'),
  ('09', 'Lice penzioner po osnovu zaposlenosti'),
  ('10', 'Lice penzioner po osnovu samostalne delatnosti'),
  ('11', 'Lice - prihodi van radnog odnosa bez doprinosa za zdravstvo'),
  ('12', 'Vojni penzioner')
ON CONFLICT DO NOTHING;

-- =============================================
-- Seed OVP catalog - Employment income (key combinations)
-- =============================================
INSERT INTO public.ovp_catalog (ovp, ola, ben, description, income_source) VALUES
  -- OVP 101 - Zarada
  ('101','00','0','Zarada bez poreske olakšice i beneficiranog staža','employment'),
  ('101','00','1','Zarada bez olakšice, beneficirani staž 12/14','employment'),
  ('101','00','2','Zarada bez olakšice, beneficirani staž 12/15','employment'),
  ('101','00','3','Zarada bez olakšice, beneficirani staž 12/16','employment'),
  ('101','00','4','Zarada bez olakšice, beneficirani staž 12/18','employment'),
  ('101','01','0','Zarada pripravnika <30 god. sa olakšicom','employment'),
  ('101','02','0','Zarada lica <30 god. sa olakšicom','employment'),
  ('101','03','0','Zarada lica sa invaliditetom sa olakšicom','employment'),
  ('101','04','0','Zarada lica >45 <50 god. sa olakšicom','employment'),
  ('101','05','0','Zarada lica >50 god. sa olakšicom','employment'),
  ('101','06','0','Zarada lica <30 ili >45 god. sa subvencijom (Uredba)','employment'),
  ('101','07','0','Zarada lica 30-45 god. sa subvencijom (Uredba)','employment'),
  ('101','08','0','Zarada novozaposlenog - povraćaj 65% poreza i doprinosa','employment'),
  ('101','09','0','Zarada novozaposlenog - povraćaj 70% poreza i doprinosa','employment'),
  ('101','10','0','Zarada novozaposlenog - povraćaj 75% poreza i doprinosa','employment'),
  -- OVP 102 - Rad u inostranstvu
  ('102','00','0','Zarada zaposlenog upućenog u inostranstvo','employment'),
  -- OVP 103-109
  ('103','00','0','Zarada domaćih državljana kod stranih organizacija','employment'),
  ('104','00','0','Zarada invalida u preduzećima za radno osposobljavanje','employment'),
  ('105','00','0','Zarada invalida rada (4 sata dnevno)','employment'),
  ('106','00','0','Lična zarada preduzetnika','employment'),
  ('107','00','0','Lična zarada preduzetnika poljoprivrednika','employment'),
  ('108','00','0','Razlika zarade izabranih/imenovanih lica','employment'),
  ('109','00','0','Doprinosi na najnižu mesečnu osnovicu','employment'),
  ('110','00','0','Naknada troškova prevoza, dnevnica - preko neoporezivog','employment'),
  ('111','00','0','Poklon deci zaposlenih - preko neoporezivog iznosa','employment'),
  ('150','00','0','Privremeni i povremeni poslovi (neposredno sa poslodavcem)','employment'),
  -- OVP 201-209 Naknade zarade
  ('201','00','0','Naknada zarade - povreda na radu/profesionalna bolest','employment'),
  ('202','00','0','Naknada zarade - bolovanje do 30 dana','employment'),
  ('203','00','0','Naknada zarade - plaćeno odsustvo/prekid rada','employment'),
  ('204','00','0','Naknada zarade - bolovanje preko 30 dana','employment'),
  ('205','00','0','Naknada zarade - bolovanje >30 dana (tkiva/nega deteta <3)','employment'),
  ('206','00','0','Naknada zarade - porodiljsko odsustvo/nega deteta','employment'),
  ('207','00','0','Naknada zarade - invalid rada na teret PIO','employment'),
  ('208','00','0','Doprinos za zdravstvo - neplaćeno odsustvo (dete <3)','employment'),
  ('209','00','0','Naknada zarade - profesionalna bolest po prestanku RO','employment'),
  -- Non-employment income
  ('301','00','0','Autorski prihod - normirani troškovi 50%, osiguran po drugom osnovu','non_employment'),
  ('302','00','0','Autorski prihod - normirani troškovi 50%, nije osiguran','non_employment'),
  ('303','00','0','Autorski prihod - normirani troškovi 43%, osiguran','non_employment'),
  ('304','00','0','Autorski prihod - normirani troškovi 43%, nije osiguran','non_employment'),
  ('305','00','0','Autorski prihod - normirani troškovi 34%, osiguran','non_employment'),
  ('306','00','0','Autorski prihod - normirani troškovi 34%, nije osiguran','non_employment'),
  ('401','00','0','Kamate po osnovu zajma, štednih depozita, HOV','non_employment'),
  ('402','00','0','Dividende i učešće u dobiti','non_employment'),
  ('405','00','0','Prihod od izdavanja nepokretnosti - normirani 25%','non_employment'),
  ('501','00','0','Prihod od zakupa pokretnih stvari - normirani 20%','non_employment'),
  ('503','00','0','Dobitnici igara na sreću','non_employment'),
  ('601','00','0','Ugovor o delu - osiguran, normirani 20%','non_employment'),
  ('602','00','0','Ugovor o delu - nije osiguran, normirani 20%','non_employment'),
  ('604','00','0','Privremeni poslovi preko omladinske zadruge (<26, školovanje)','non_employment'),
  ('605','00','0','Prihodi od dopunskog rada','non_employment'),
  ('999','00','0','Ostali prihodi','non_employment')
ON CONFLICT (ovp, ola, ben) DO NOTHING;

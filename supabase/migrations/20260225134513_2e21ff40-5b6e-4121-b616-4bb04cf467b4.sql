
-- Update existing payment types with official data
UPDATE payroll_payment_types SET 
  osnovna_tabela = 1, satnica_tip = 'K', payment_category = 'Z', 
  compensation_pct = 0, surcharge_pct = 0, gl_debit = '5200', gl_credit = '4500',
  reduces_regular = false, includes_hot_meal = true, is_advance = false, is_storno = false
WHERE code = '100';

UPDATE payroll_payment_types SET 
  satnica_tip = 'P', payment_category = 'B', 
  compensation_pct = 65, surcharge_pct = 0, reduces_regular = true, includes_hot_meal = false
WHERE code = '101';

UPDATE payroll_payment_types SET 
  satnica_tip = 'P', payment_category = 'N',
  compensation_pct = 100, surcharge_pct = 0, reduces_regular = true, includes_hot_meal = false
WHERE code = '102';

UPDATE payroll_payment_types SET 
  satnica_tip = 'P', payment_category = 'N',
  compensation_pct = 100, surcharge_pct = 0, reduces_regular = true, includes_hot_meal = true
WHERE code = '103';

UPDATE payroll_payment_types SET 
  satnica_tip = 'K', payment_category = 'Z',
  compensation_pct = 0, surcharge_pct = 26, reduces_regular = false
WHERE code = '104';

UPDATE payroll_payment_types SET 
  satnica_tip = 'K', payment_category = 'Z',
  compensation_pct = 0, surcharge_pct = 26, reduces_regular = false
WHERE code = '109';

UPDATE payroll_payment_types SET 
  satnica_tip = 'N', payment_category = 'N', is_nontaxable = true,
  compensation_pct = 0, surcharge_pct = 100, reduces_regular = false, includes_hot_meal = false
WHERE code = '180';

UPDATE payroll_payment_types SET 
  satnica_tip = 'N', payment_category = 'N', is_nontaxable = true,
  compensation_pct = 0, surcharge_pct = 100, reduces_regular = false, includes_hot_meal = false
WHERE code = '181';

-- Insert missing payment types from official catalog
INSERT INTO payroll_payment_types (tenant_id, code, name, type, is_hourly, rate_multiplier, is_nontaxable, is_active, osnovna_tabela, satnica_tip, payment_category, compensation_pct, surcharge_pct, gl_debit, gl_credit, reduces_regular, includes_hot_meal, is_advance, is_storno, is_benefit)
SELECT t.id, v.code, v.name, v.type, v.is_hourly, v.rate_multiplier, v.is_nontaxable, true, v.osnovna_tabela, v.satnica_tip, v.payment_category, v.compensation_pct, v.surcharge_pct, v.gl_debit, v.gl_credit, v.reduces_regular, v.includes_hot_meal, v.is_advance, v.is_storno, v.is_benefit
FROM (SELECT id FROM tenants) t
CROSS JOIN (VALUES
  ('105','Redovan rad za vreme drž. praznika','zarada',true,1.0,false,1,'P','Z',100,110,'5200','4500',false,true,false,false,false),
  ('106','Noćni rad u vreme drž. praznika','zarada',true,1.0,false,1,'K','Z',100,126,'5200','4500',false,true,false,false,false),
  ('107','Povreda na radu','naknada',false,1.0,false,1,'P','N',100,0,'5200','4500',true,false,false,false,false),
  ('108','Plaćeno odsustvo','naknada',false,1.0,false,1,'K','N',100,0,'5200','4500',true,false,false,false,false),
  ('110','Rad u smenama','zarada',true,1.0,false,1,'K','Z',100,26,'5200','4500',true,true,false,false,false),
  ('111','Bonus na osnovu poslovnog uspeha','zarada',true,1.0,false,1,'K','Z',0,100,'5200','4500',false,true,false,false,false),
  ('148','Akontacija zarade (časovni)','zarada',true,1.0,false,1,'K','A',100,0,'5200','4500',false,false,true,false,false),
  ('150','Redovan rad (mesečni)','zarada',false,1.0,false,1,'N','Z',100,0,'5200','4500',false,true,false,false,false),
  ('151','Bolovanje do 30 dana (mesečni)','naknada',false,1.0,false,1,'P','N',100,0,'5200','4500',true,false,false,false,false),
  ('152','Godišnji odmor (mesečni)','naknada',false,1.0,false,1,'N','N',100,0,'5200','4500',true,false,false,false,false),
  ('190','Korekcija zarade','zarada',false,1.0,false,1,'N','Z',100,0,'5200','4500',false,false,false,false,false),
  ('191','Van rada','zarada',false,1.0,true,1,'N','Z',100,0,'5200','4500',true,false,false,false,false),
  ('192','Korekcija bolovanja preko 30 dana','naknada',false,1.0,true,2,'N','N',100,0,'2252','4540',true,false,false,false,false),
  ('198','Akontacija zarade (mesečni)','zarada',false,1.0,false,1,'N','A',100,0,'5200','4500',false,false,true,false,false),
  ('199','Isplaćena akontacija','zarada',false,1.0,false,1,'N','S',100,0,'5200','4500',false,false,false,true,false),
  ('200','Bolovanje >30 dana na teret RFZO (časovni)','naknada',true,1.0,true,2,'K','B',65,0,'2252','4540',true,false,false,false,true),
  ('248','Akontacija bolovanje >30 dana (časovni)','naknada',true,1.0,true,2,'K','A',65,0,'2252','4540',true,false,true,false,true),
  ('250','Bolovanje >30 dana na teret RFZO (mesečni)','naknada',false,1.0,true,2,'N','B',100,0,'2252','4540',true,false,false,false,true),
  ('298','Akontacija bolovanje >30 dana (mesečni)','naknada',false,1.0,true,2,'N','A',100,0,'2252','4540',true,false,true,false,true),
  ('299','Ispl. akont. bolovanje >30 dana','naknada',false,1.0,true,2,'N','S',100,0,'2252','4540',true,false,false,true,true),
  ('300','Porodiljsko bolovanje','naknada',true,1.0,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
  ('301','Naknada zbog nege deteta','naknada',true,1.0,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
  ('302','Posebna nega deteta','naknada',true,1.0,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
  ('348','Akont. za por. bolovanje i sl. (časovni)','naknada',true,1.0,true,3,'K','A',100,0,'2251','4540',true,false,true,false,true),
  ('350','Porodiljsko bolovanje (mesečni)','naknada',false,1.0,true,3,'N','B',100,0,'2251','4540',true,false,false,false,true),
  ('351','Naknada zbog nege deteta (mesečni)','naknada',false,1.0,true,3,'N','B',100,0,'2251','4540',true,false,false,false,true),
  ('352','Posebna nega deteta (mesečni)','naknada',false,1.0,true,3,'N','B',100,0,'2251','4540',true,false,false,false,true),
  ('398','Akont. porodiljsko i sl. (mesečni)','naknada',false,1.0,true,3,'N','A',100,0,'2251','4540',true,false,true,false,true),
  ('399','Ispl. akont. porodiljsko i sl.','naknada',false,1.0,true,3,'N','S',100,0,'2251','4540',true,false,false,true,true),
  ('400','Naknada za invalidnost (časovni)','naknada',true,1.0,true,4,'K','B',100,0,'2252','4540',true,false,false,false,true),
  ('450','Naknada za invalidnost (mesečni)','naknada',false,1.0,true,4,'N','B',100,0,'2252','4540',true,false,false,false,true)
) AS v(code,name,type,is_hourly,rate_multiplier,is_nontaxable,osnovna_tabela,satnica_tip,payment_category,compensation_pct,surcharge_pct,gl_debit,gl_credit,reduces_regular,includes_hot_meal,is_advance,is_storno,is_benefit)
WHERE NOT EXISTS (SELECT 1 FROM payroll_payment_types pt WHERE pt.code = v.code AND pt.tenant_id = t.id);

-- =============================================
-- P1: Expand payroll_income_categories from 12 to 52
-- Insert categories K13-K52 for all existing tenants
-- =============================================
INSERT INTO payroll_income_categories (tenant_id, code, name, ovp_code, ola_code, ben_code, tax_rate, pio_employee_rate, pio_employer_rate, health_employee_rate, health_employer_rate, unemployment_employee_rate, unemployment_employer_rate, employer_tax_exempt, employer_pio_exempt, employer_health_exempt, subsidy_tax_pct, subsidy_pio_employee_pct, subsidy_pio_employer_pct, subsidy_health_employee_pct, subsidy_health_employer_pct, subsidy_unemployment_employee_pct, subsidy_unemployment_employer_pct, notes)
SELECT t.id, v.code, v.name, v.ovp_code, v.ola_code, v.ben_code, v.tax_rate, v.pio_e, v.pio_p, v.health_e, v.health_p, v.unemp_e, v.unemp_p, v.tax_exempt, v.pio_exempt, v.health_exempt, v.sub_tax, v.sub_pio_e, v.sub_pio_p, v.sub_health_e, v.sub_health_p, v.sub_unemp_e, v.sub_unemp_p, v.notes
FROM (SELECT DISTINCT tenant_id as id FROM payroll_income_categories) t
CROSS JOIN (VALUES
  ('K13','Penzioner - radni odnos','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Bez doprinosa za nezaposlenost'),
  ('K14','Lična zarada preduzetnika (osiguran po drugom osnovu)','106','00','0',0.10,0.24,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'PIO 24%, bez zdravstvenog'),
  ('K15','Lična zarada preduzetnika (nije osiguran)','106','00','0',0.10,0.24,0.0,0.103,0.0,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Puni doprinosi na preduzetnika'),
  ('K16','Vlasnik van RO (nije osiguran)','108','00','0',0.0,0.24,0.0,0.103,0.0,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Bez poreza, puni doprinosi'),
  ('K17','Vlasnik van RO (osiguran po drugom osnovu)','108','00','0',0.0,0.24,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Samo PIO 24%'),
  ('K18','Preduzetnik penzioner','106','00','0',0.10,0.24,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Samo PIO'),
  ('K19','Preduzetnik poljoprivrednik','107','00','0',0.10,0.24,0.0,0.103,0.0,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,NULL),
  ('K20','Novozaposleni 01.07.2014 - refundacija 65%','101','08','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Pravo na povraćaj 65%'),
  ('K21','Novozaposleni 01.07.2014 - refundacija 70%','101','09','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Pravo na povraćaj 70%'),
  ('K22','Novozaposleni 01.07.2014 - refundacija 75%','101','10','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Pravo na povraćaj 75%'),
  ('K23','Novozaposleni mikro/malo pravno lice - ref. 75%','101','10','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Mikro i malo pravno lice'),
  ('K24','Osnivač sa olakšicom 21đ (bez PIO)','101','00','0',0.0,0.0,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Potpuno oslobođen'),
  ('K25','Osnivač sa olakšicom 21đ (sa PIO)','101','00','0',0.0,0.14,0.10,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Samo PIO'),
  ('K26','Preduzetnik od 01.10.2018 (bez PIO)','106','00','0',0.0,0.0,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'21đ - potpuno oslobođen'),
  ('K27','Preduzetnik od 01.10.2018 (sa PIO)','106','00','0',0.0,0.24,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'21đ - samo PIO 24%'),
  ('K28','Osnivači - subvencije 21đ/45g','101','00','0',0.0,0.0,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Potpuno subvencionisan'),
  ('K29','Preduzetnici - subvencije 21đ/45g','106','00','0',0.0,0.0,0.0,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Potpuno subvencionisan'),
  ('K30','Novozaposleni 2020 (21ž) - PIO 100%, porez 70%','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,70,100,100,0,0,0,0,'Čl. 21ž Zakona'),
  ('K31','Novozaposleni 2020 (21ž) - PIO 95%, porez 65%','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,65,95,95,0,0,0,0,NULL),
  ('K32','Novozaposleni 2020 (21ž) - PIO 85%, porez 60%','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,60,85,85,0,0,0,0,NULL),
  ('K33','Novonastanjeni obveznik - umanjenje 70%','101','00','0',0.03,0.042,0.03,0.01545,0.01545,0.00225,0.0,false,false,false,0,0,0,0,0,0,0,'Čl. 15v-15a Zakona'),
  ('K34','Novozaposleni 2020 - PIO 85%, porez 60% (2023-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,60,85,85,0,0,0,0,NULL),
  ('K35','Novozaposleni 2020 - PIO 75%, porez 50% (2023-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,50,75,75,0,0,0,0,NULL),
  ('K36','Novozaposleni 2020 - PIO 65%, porez 40% (2023-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,40,65,65,0,0,0,0,NULL),
  ('K37','Novozaposleni 2020 - PIO 55%, porez 30% (2023-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,30,55,55,0,0,0,0,NULL),
  ('K38','Novozaposleni 2022 - PIO 82%, porez 57% (2022-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,57,82,82,0,0,0,0,NULL),
  ('K39','Novozaposleni 2022 - PIO 72%, porez 47% (2022-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,47,72,72,0,0,0,0,NULL),
  ('K40','Novozaposleni 2022 - PIO 62%, porez 37% (2022-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,37,62,62,0,0,0,0,NULL),
  ('K41','Novozaposleni 2022 - PIO 52%, porez 27% (2022-2025)','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,27,52,52,0,0,0,0,NULL),
  ('K42','Novozaposleni 03/2022 (21z) - PIO 100%, porez 70%','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,70,100,100,0,0,0,0,'2022-2024'),
  ('K43','Novozaposleni 03/2022 (21i) - PIO 100%, porez 70%','101','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,70,100,100,0,0,0,0,NULL),
  ('K51','Privremeni poslovi - nemaju drugo osiguranje','150','00','0',0.10,0.14,0.10,0.0515,0.0515,0.0075,0.0,false,false,false,0,0,0,0,0,0,0,'Nema pravo na olakšicu'),
  ('K52','Privremeni poslovi - penzioneri','150','00','0',0.10,0.14,0.10,0.0,0.0,0.0,0.0,false,false,false,0,0,0,0,0,0,0,'Nema pravo na olakšicu')
) AS v(code,name,ovp_code,ola_code,ben_code,tax_rate,pio_e,pio_p,health_e,health_p,unemp_e,unemp_p,tax_exempt,pio_exempt,health_exempt,sub_tax,sub_pio_e,sub_pio_p,sub_health_e,sub_health_p,sub_unemp_e,sub_unemp_p,notes)
WHERE NOT EXISTS (SELECT 1 FROM payroll_income_categories c WHERE c.code = v.code AND c.tenant_id = t.id);

-- Create seed function for payment types
CREATE OR REPLACE FUNCTION public.seed_payroll_payment_types(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payroll_payment_types (tenant_id, code, name, type, is_hourly, rate_multiplier, is_nontaxable, is_active, osnovna_tabela, satnica_tip, payment_category, compensation_pct, surcharge_pct, gl_debit, gl_credit, reduces_regular, includes_hot_meal, is_advance, is_storno, is_benefit)
  VALUES
    (p_tenant_id,'100','Redovan rad','zarada',true,1.0,false,true,1,'K','Z',0,0,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'101','Bolovanje na teret poslodavca','naknada',false,1.0,false,true,1,'P','B',65,0,'5200','4500',true,false,false,false,false),
    (p_tenant_id,'102','Godišnji odmor','naknada',false,1.0,false,true,1,'P','N',100,0,'5200','4500',true,false,false,false,false),
    (p_tenant_id,'103','Državni/Verski praznik','naknada',false,1.0,false,true,1,'P','N',100,0,'5200','4500',true,true,false,false,false),
    (p_tenant_id,'104','Noćni rad','zarada',true,1.0,false,true,1,'K','Z',0,26,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'105','Red. rad za vreme drž. praznika','zarada',true,1.0,false,true,1,'P','Z',100,110,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'106','Noćni rad u vreme drž. praznika','zarada',true,1.0,false,true,1,'K','Z',100,126,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'107','Povreda na radu','naknada',false,1.0,false,true,1,'P','N',100,0,'5200','4500',true,false,false,false,false),
    (p_tenant_id,'108','Plaćeno odsustvo','naknada',false,1.0,false,true,1,'K','N',100,0,'5200','4500',true,false,false,false,false),
    (p_tenant_id,'109','Prekovremeni rad','zarada',true,1.0,false,true,1,'K','Z',0,26,'5200','4500',false,false,false,false,false),
    (p_tenant_id,'110','Rad u smenama','zarada',true,1.0,false,true,1,'K','Z',100,26,'5200','4500',true,true,false,false,false),
    (p_tenant_id,'111','Bonus na osnovu pos. uspeha','zarada',true,1.0,false,true,1,'K','Z',0,100,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'148','Akontacija zarade','zarada',true,1.0,false,true,1,'K','A',100,0,'5200','4500',false,false,true,false,false),
    (p_tenant_id,'150','Redovan rad (mesečni)','zarada',false,1.0,false,true,1,'N','Z',100,0,'5200','4500',false,true,false,false,false),
    (p_tenant_id,'180','Topli obrok','naknada',false,1.0,true,true,1,'N','N',0,100,'5200','4500',false,false,false,false,false),
    (p_tenant_id,'181','Regres za GO','naknada',false,1.0,true,true,1,'N','N',0,100,'5200','4500',false,false,false,false,false),
    (p_tenant_id,'190','Korekcija zarade','zarada',false,1.0,false,true,1,'N','Z',100,0,'5200','4500',false,false,false,false,false),
    (p_tenant_id,'200','Bolovanje >30 dana (RFZO, časovni)','naknada',true,1.0,true,true,2,'K','B',65,0,'2252','4540',true,false,false,false,true),
    (p_tenant_id,'250','Bolovanje >30 dana (RFZO, mesečni)','naknada',false,1.0,true,true,2,'N','B',100,0,'2252','4540',true,false,false,false,true),
    (p_tenant_id,'300','Porodiljsko bolovanje','naknada',true,1.0,true,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
    (p_tenant_id,'301','Naknada nege deteta','naknada',true,1.0,true,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
    (p_tenant_id,'302','Posebna nega deteta','naknada',true,1.0,true,true,3,'K','B',100,0,'2251','4540',true,false,false,false,true),
    (p_tenant_id,'350','Porodiljsko bolovanje (mesečni)','naknada',false,1.0,true,true,3,'N','B',100,0,'2251','4540',true,false,false,false,true),
    (p_tenant_id,'400','Naknada za invalidnost','naknada',true,1.0,true,true,4,'K','B',100,0,'2252','4540',true,false,false,false,true),
    (p_tenant_id,'450','Naknada za invalidnost (mesečni)','naknada',false,1.0,true,true,4,'N','B',100,0,'2252','4540',true,false,false,false,true)
  ON CONFLICT DO NOTHING;
END;
$$;

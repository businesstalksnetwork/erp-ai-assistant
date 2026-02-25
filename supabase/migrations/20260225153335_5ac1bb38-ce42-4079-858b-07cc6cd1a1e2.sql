
-- Seed DMS default data for all existing tenants
-- Function to seed DMS data for a given tenant
CREATE OR REPLACE FUNCTION public.seed_dms_defaults(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_javno_id uuid;
  v_interno_id uuid;
  v_poverljivo_id uuid;
  v_strogo_id uuid;
BEGIN
  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM document_categories WHERE tenant_id = p_tenant_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Document Categories
  INSERT INTO document_categories (tenant_id, group_name, group_name_sr, code, name, name_sr, sort_order) VALUES
    (p_tenant_id, 'General Administration', 'Opšta administracija', 'GEN-01', 'Correspondence', 'Dopisi', 1),
    (p_tenant_id, 'General Administration', 'Opšta administracija', 'GEN-02', 'Decisions', 'Rešenja', 2),
    (p_tenant_id, 'General Administration', 'Opšta administracija', 'GEN-03', 'Contracts', 'Ugovori', 3),
    (p_tenant_id, 'General Administration', 'Opšta administracija', 'GEN-04', 'Regulations', 'Pravilnici', 4),
    (p_tenant_id, 'Finance', 'Finansije', 'FIN-01', 'Invoices', 'Fakture', 10),
    (p_tenant_id, 'Finance', 'Finansije', 'FIN-02', 'Bank Statements', 'Izvodi', 11),
    (p_tenant_id, 'Finance', 'Finansije', 'FIN-03', 'Calculations', 'Obračuni', 12),
    (p_tenant_id, 'Finance', 'Finansije', 'FIN-04', 'Tax Returns', 'Poreske prijave', 13),
    (p_tenant_id, 'HR', 'Kadrovi', 'HR-01', 'Employment Contracts', 'Ugovori o radu', 20),
    (p_tenant_id, 'HR', 'Kadrovi', 'HR-02', 'Leave Decisions', 'Rešenja o odmorima', 21),
    (p_tenant_id, 'HR', 'Kadrovi', 'HR-03', 'Personnel Files', 'Dosijei zaposlenih', 22),
    (p_tenant_id, 'HR', 'Kadrovi', 'HR-04', 'Training Records', 'Evidencija obuka', 23),
    (p_tenant_id, 'Sales', 'Komercijala', 'SAL-01', 'Quotes', 'Ponude', 30),
    (p_tenant_id, 'Sales', 'Komercijala', 'SAL-02', 'Purchase Orders', 'Narudžbine', 31),
    (p_tenant_id, 'Sales', 'Komercijala', 'SAL-03', 'Dispatch Notes', 'Otpremnice', 32),
    (p_tenant_id, 'Sales', 'Komercijala', 'SAL-04', 'Complaints', 'Reklamacije', 33),
    (p_tenant_id, 'Projects', 'Projekti', 'PRJ-01', 'Project Documentation', 'Projektna dokumentacija', 40),
    (p_tenant_id, 'Projects', 'Projekti', 'PRJ-02', 'Reports', 'Izveštaji', 41);

  -- Confidentiality Levels
  INSERT INTO confidentiality_levels (id, tenant_id, name, name_sr, color, sort_order) VALUES
    (gen_random_uuid(), p_tenant_id, 'Public', 'Javno', '#22c55e', 1)
    RETURNING id INTO v_javno_id;
  INSERT INTO confidentiality_levels (id, tenant_id, name, name_sr, color, sort_order) VALUES
    (gen_random_uuid(), p_tenant_id, 'Internal', 'Interno', '#3b82f6', 2)
    RETURNING id INTO v_interno_id;
  INSERT INTO confidentiality_levels (id, tenant_id, name, name_sr, color, sort_order) VALUES
    (gen_random_uuid(), p_tenant_id, 'Confidential', 'Poverljivo', '#f97316', 3)
    RETURNING id INTO v_poverljivo_id;
  INSERT INTO confidentiality_levels (id, tenant_id, name, name_sr, color, sort_order) VALUES
    (gen_random_uuid(), p_tenant_id, 'Top Secret', 'Strogo poverljivo', '#ef4444', 4)
    RETURNING id INTO v_strogo_id;

  -- Access Matrix
  -- admin: all levels, read + edit
  INSERT INTO role_confidentiality_access (tenant_id, role, confidentiality_level_id, can_read, can_edit) VALUES
    (p_tenant_id, 'admin', v_javno_id, true, true),
    (p_tenant_id, 'admin', v_interno_id, true, true),
    (p_tenant_id, 'admin', v_poverljivo_id, true, true),
    (p_tenant_id, 'admin', v_strogo_id, true, true);
  -- manager: javno + interno + poverljivo
  INSERT INTO role_confidentiality_access (tenant_id, role, confidentiality_level_id, can_read, can_edit) VALUES
    (p_tenant_id, 'manager', v_javno_id, true, true),
    (p_tenant_id, 'manager', v_interno_id, true, true),
    (p_tenant_id, 'manager', v_poverljivo_id, true, true);
  -- user: javno + interno, read only
  INSERT INTO role_confidentiality_access (tenant_id, role, confidentiality_level_id, can_read, can_edit) VALUES
    (p_tenant_id, 'user', v_javno_id, true, false),
    (p_tenant_id, 'user', v_interno_id, true, false);
END;
$$;

-- Seed for all existing tenants
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    PERFORM seed_dms_defaults(t_id);
  END LOOP;
END;
$$;

-- Trigger to auto-seed for new tenants
CREATE OR REPLACE FUNCTION public.trigger_seed_dms_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_dms_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_dms_defaults ON public.tenants;
CREATE TRIGGER trg_seed_dms_defaults
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_dms_defaults();

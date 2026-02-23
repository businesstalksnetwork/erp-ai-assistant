
-- =============================================================
-- Phase 1A: Serbian Kontni Plan alignment
-- Add missing standard accounts to the seed function
-- =============================================================

-- Replace the seed function with full Serbian kontni plan
CREATE OR REPLACE FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
  VALUES
    -- Class 0: Stalna imovina (Non-current assets)
    (_tenant_id, '0100', 'Intangible Assets', 'Нематеријална улагања', 'asset', 1, true, true),
    (_tenant_id, '0200', 'Buildings', 'Грађевински објекти', 'asset', 1, true, true),
    (_tenant_id, '0300', 'Equipment', 'Постројења и опрема', 'asset', 1, true, true),
    (_tenant_id, '0400', 'Vehicles', 'Транспортна средства', 'asset', 1, true, true),
    (_tenant_id, '0500', 'Office Equipment', 'Канцеларијска опрема', 'asset', 1, true, true),
    (_tenant_id, '0600', 'Long-term Financial Assets', 'Дугорочни финансијски пласмани', 'asset', 1, true, true),
    (_tenant_id, '0900', 'Assets Under Construction', 'Средства у припреми', 'asset', 1, true, true),

    -- Class 1: Zalihe i kratkotrajna imovina (Inventories & Current Assets)
    (_tenant_id, '1000', 'Cash and Bank', 'Готовина и банка', 'asset', 1, true, true),
    (_tenant_id, '1200', 'Accounts Receivable', 'Потраживања од купаца', 'asset', 1, true, true),
    (_tenant_id, '1290', 'Accumulated Depreciation', 'Исправка вредности', 'asset', 1, true, true),
    (_tenant_id, '1300', 'Merchandise at Cost', 'Роба по набавној вредности', 'asset', 1, true, true),
    (_tenant_id, '1320', 'Merchandise at Retail', 'Роба у малопродаји', 'asset', 1, true, true),
    (_tenant_id, '1329', 'Trade Margin', 'Разлика у цени робе', 'asset', 1, true, true),
    (_tenant_id, '1340', 'Embedded VAT in Retail', 'Укалкулисани ПДВ у промету на мало', 'asset', 1, true, true),
    (_tenant_id, '1800', 'Prepaid Expenses', 'Унапред плаћени трошкови', 'asset', 1, true, true),

    -- Class 2: Kratkorocne obaveze (Current liabilities & financial accounts)
    (_tenant_id, '2040', 'Trade Receivables', 'Потраживања од купаца - књиговодство', 'asset', 1, true, true),
    (_tenant_id, '2100', 'Accounts Payable', 'Обавезе према добављачима', 'liability', 1, true, true),
    (_tenant_id, '2200', 'Loans Payable', 'Обавезе по кредитима', 'liability', 1, true, true),
    (_tenant_id, '2410', 'Bank Accounts', 'Текући рачуни', 'asset', 1, true, true),
    (_tenant_id, '2430', 'Cash Register', 'Благајна', 'asset', 1, true, true),
    (_tenant_id, '2431', 'Giro Account', 'Жиро рачун', 'asset', 1, true, true),
    (_tenant_id, '2470', 'Output VAT', 'ПДВ обрачунат на промет', 'liability', 1, true, true),
    (_tenant_id, '2500', 'Deferred Revenue', 'Разграничени приходи', 'liability', 1, true, true),

    -- Class 3: Kapital (Equity)
    (_tenant_id, '3000', 'Equity', 'Капитал', 'equity', 1, true, true),
    (_tenant_id, '3100', 'Share Capital', 'Основни капитал', 'equity', 1, true, true),
    (_tenant_id, '3200', 'Reserves', 'Резерве', 'equity', 1, true, true),
    (_tenant_id, '3300', 'Retained Earnings', 'Нераспоређена добит', 'equity', 1, true, true),
    (_tenant_id, '3400', 'Accumulated Losses', 'Губитак', 'equity', 1, true, true),

    -- Class 4: Dugorocne obaveze i PDV (Long-term liabilities)
    (_tenant_id, '4000', 'Revenue', 'Приходи од продаје', 'revenue', 1, true, true),
    (_tenant_id, '4100', 'Interest Income', 'Приходи од камата', 'revenue', 1, true, true),
    (_tenant_id, '4200', 'Gain on Disposal', 'Добици од продаје средстава', 'revenue', 1, true, true),
    (_tenant_id, '4300', 'Advance Payments Received', 'Примљени аванси', 'liability', 1, true, true),
    (_tenant_id, '4700', 'Tax Payable (VAT)', 'Обавезе за ПДВ', 'liability', 1, true, true),

    -- Class 5: Rashodi (Expenses - production/COGS)
    (_tenant_id, '5000', 'Work in Progress', 'Производња у току', 'asset', 1, true, true),
    (_tenant_id, '5010', 'Cost of Goods Sold (Retail)', 'Набавна вредност продате робе (малопродаја)', 'expense', 1, true, true),
    (_tenant_id, '5100', 'Finished Goods', 'Готови производи', 'asset', 1, true, true),
    (_tenant_id, '5200', 'Raw Materials', 'Сировине и материјал', 'expense', 1, true, true),
    (_tenant_id, '5630', 'FX Loss (Realized)', 'Курсне разлике - расход', 'expense', 1, true, true),

    -- Class 6: Prihodi (Revenue)
    (_tenant_id, '6000', 'Sales Revenue', 'Приходи од продаје', 'revenue', 1, true, true),
    (_tenant_id, '6010', 'Retail Sales Revenue', 'Приходи од малопродаје', 'revenue', 1, true, true),
    (_tenant_id, '6630', 'FX Gain (Realized)', 'Курсне разлике - приход', 'revenue', 1, true, true),

    -- Class 7: Finansijski prihodi/rashodi
    (_tenant_id, '7000', 'Cost of Goods Sold', 'Набавна вредност продате робе', 'expense', 1, true, true),
    (_tenant_id, '7100', 'Material Costs', 'Трошкови материјала', 'expense', 1, true, true),
    (_tenant_id, '7200', 'Salary Costs', 'Трошкови зарада', 'expense', 1, true, true),
    (_tenant_id, '7300', 'Depreciation Costs', 'Трошкови амортизације', 'expense', 1, true, true),
    (_tenant_id, '7400', 'Other Operating Costs', 'Остали пословни расходи', 'expense', 1, true, true),

    -- Class 8: Vanredni prihodi/rashodi (extraordinary)
    (_tenant_id, '8000', 'General Expenses', 'Општи трошкови', 'expense', 1, true, true),
    (_tenant_id, '8100', 'Depreciation Expense', 'Амортизација', 'expense', 1, true, true),
    (_tenant_id, '8200', 'Loss on Disposal', 'Губици од расходовања', 'expense', 1, true, true),
    (_tenant_id, '8300', 'Interest Expense', 'Расходи камата', 'expense', 1, true, true),

    -- Class 9: Obracun troskova i ucinka
    (_tenant_id, '9000', 'Internal Cost Allocation', 'Обрачун трошкова и учинака', 'expense', 1, true, true),
    (_tenant_id, '9100', 'Internal Revenue Allocation', 'Интерни обрачун прихода', 'revenue', 1, true, true)

  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name_sr = EXCLUDED.name_sr,
    is_system = true,
    is_active = true;
END;
$fn$;

-- Add unique constraint on (tenant_id, code) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chart_of_accounts_tenant_code_unique'
  ) THEN
    ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_tenant_code_unique UNIQUE (tenant_id, code);
  END IF;
END $$;

-- =============================================================
-- Phase 1B: Audit Trail Enhancements
-- =============================================================

-- Add before_state, after_state, ip_address to audit_log
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS before_state jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS after_state jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip_address text;

-- Add storno_reason to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS storno_reason text;

-- Update log_audit_event to populate before_state and after_state
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action text;
  v_details jsonb;
  v_entity_id uuid;
  v_tenant_id uuid;
  v_user_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_action := lower(TG_OP);
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_tenant_id := OLD.tenant_id;
    v_before := row_to_json(OLD)::jsonb;
    v_after := NULL;
    v_details := jsonb_build_object('old', v_before);
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_before := row_to_json(OLD)::jsonb;
    v_after := row_to_json(NEW)::jsonb;
    v_details := jsonb_build_object('old', v_before, 'new', v_after);
  ELSE -- INSERT
    v_entity_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_before := NULL;
    v_after := row_to_json(NEW)::jsonb;
    v_details := jsonb_build_object('new', v_after);
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details, before_state, after_state)
  VALUES (v_tenant_id, v_user_id, v_action, TG_TABLE_NAME, v_entity_id, v_details, v_before, v_after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add audit trigger on supplier_invoices if not already present
CREATE OR REPLACE TRIGGER audit_supplier_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

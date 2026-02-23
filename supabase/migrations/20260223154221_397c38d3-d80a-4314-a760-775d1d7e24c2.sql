
-- =============================================
-- CRM Phase 1: Account Tiering, Dormancy, Contact Roles, CRM Tasks
-- =============================================

-- 1. New columns on partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS account_tier TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tier_revenue_12m NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS dormancy_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS dormancy_detected_at TIMESTAMPTZ;

-- 2. New column on contact_company_assignments
ALTER TABLE public.contact_company_assignments
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL;

-- 3. Create crm_tasks table
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant ON public.crm_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_partner ON public.crm_tasks(partner_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);

-- RLS for crm_tasks
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view crm_tasks"
  ON public.crm_tasks FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert crm_tasks"
  ON public.crm_tasks FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can update crm_tasks"
  ON public.crm_tasks FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete crm_tasks"
  ON public.crm_tasks FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Function: calculate_partner_tiers
CREATE OR REPLACE FUNCTION public.calculate_partner_tiers(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_partners INT;
BEGIN
  -- Enforce tenant membership
  PERFORM public.assert_tenant_member(p_tenant_id);

  -- Calculate trailing 12-month revenue per partner and update
  WITH revenue AS (
    SELECT
      p.id AS partner_id,
      COALESCE(SUM(i.total), 0) AS rev_12m
    FROM partners p
    LEFT JOIN invoices i ON i.partner_id = p.id
      AND i.tenant_id = p_tenant_id
      AND i.invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
      AND i.status IN ('sent', 'paid', 'posted', 'overdue')
    WHERE p.tenant_id = p_tenant_id AND p.is_active = true
    GROUP BY p.id
  ),
  ranked AS (
    SELECT
      partner_id,
      rev_12m,
      CASE
        WHEN rev_12m = 0 THEN 'D'
        ELSE
          CASE
            WHEN PERCENT_RANK() OVER (ORDER BY rev_12m DESC) <= 0.20 THEN 'A'
            WHEN PERCENT_RANK() OVER (ORDER BY rev_12m DESC) <= 0.50 THEN 'B'
            WHEN PERCENT_RANK() OVER (ORDER BY rev_12m DESC) <= 0.80 THEN 'C'
            ELSE 'D'
          END
      END AS tier
    FROM revenue
    WHERE rev_12m > 0

    UNION ALL

    SELECT partner_id, 0 AS rev_12m, 'D' AS tier
    FROM revenue WHERE rev_12m = 0
  )
  UPDATE partners p
  SET
    account_tier = r.tier,
    tier_revenue_12m = r.rev_12m,
    tier_updated_at = now()
  FROM ranked r
  WHERE p.id = r.partner_id AND p.tenant_id = p_tenant_id;
END;
$$;

-- 5. Function: detect_partner_dormancy
CREATE OR REPLACE FUNCTION public.detect_partner_dormancy(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner RECORD;
  v_days_since INT;
  v_new_status TEXT;
  v_old_status TEXT;
  v_at_risk_threshold INT;
  v_dormant_threshold INT;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  FOR v_partner IN
    SELECT
      p.id,
      p.account_tier,
      p.dormancy_status,
      MAX(i.invoice_date) AS max_invoice_date
    FROM partners p
    LEFT JOIN invoices i ON i.partner_id = p.id
      AND i.tenant_id = p_tenant_id
      AND i.status IN ('sent', 'paid', 'posted', 'overdue')
    WHERE p.tenant_id = p_tenant_id AND p.is_active = true
    GROUP BY p.id, p.account_tier, p.dormancy_status
  LOOP
    -- Update last_invoice_date
    UPDATE partners SET last_invoice_date = v_partner.max_invoice_date WHERE id = v_partner.id;

    IF v_partner.max_invoice_date IS NULL THEN
      v_new_status := 'dormant';
      v_days_since := 9999;
    ELSE
      v_days_since := CURRENT_DATE - v_partner.max_invoice_date;

      -- Tier-specific thresholds
      CASE COALESCE(v_partner.account_tier, 'D')
        WHEN 'A' THEN v_at_risk_threshold := 60;  v_dormant_threshold := 120;
        WHEN 'B' THEN v_at_risk_threshold := 90;  v_dormant_threshold := 180;
        ELSE          v_at_risk_threshold := 120; v_dormant_threshold := 240;
      END CASE;

      IF v_days_since >= v_dormant_threshold THEN
        v_new_status := 'dormant';
      ELSIF v_days_since >= v_at_risk_threshold THEN
        v_new_status := 'at_risk';
      ELSE
        v_new_status := 'active';
      END IF;
    END IF;

    v_old_status := COALESCE(v_partner.dormancy_status, 'active');

    -- Update partner dormancy status
    IF v_new_status != v_old_status THEN
      UPDATE partners
      SET dormancy_status = v_new_status,
          dormancy_detected_at = CASE WHEN v_new_status != 'active' THEN now() ELSE NULL END
      WHERE id = v_partner.id;

      -- Create CRM task on transition to at_risk or dormant (avoid duplicates)
      IF v_new_status IN ('at_risk', 'dormant') THEN
        IF NOT EXISTS (
          SELECT 1 FROM crm_tasks
          WHERE partner_id = v_partner.id
            AND task_type = 'dormancy_alert'
            AND status IN ('open', 'in_progress')
            AND tenant_id = p_tenant_id
        ) THEN
          INSERT INTO crm_tasks (tenant_id, partner_id, title, description, task_type, priority, due_date)
          VALUES (
            p_tenant_id,
            v_partner.id,
            CASE v_new_status
              WHEN 'dormant' THEN 'Dormant account — no activity for ' || v_days_since || ' days'
              ELSE 'Account at risk — no activity for ' || v_days_since || ' days'
            END,
            'Automated alert: This account has had no invoicing activity. Consider reaching out.',
            'dormancy_alert',
            CASE v_new_status WHEN 'dormant' THEN 'high' ELSE 'medium' END,
            CURRENT_DATE + INTERVAL '7 days'
          );
        END IF;
      END IF;
    ELSE
      -- Just update status in case it hasn't been set yet
      UPDATE partners SET dormancy_status = v_new_status WHERE id = v_partner.id AND dormancy_status IS DISTINCT FROM v_new_status;
    END IF;
  END LOOP;
END;
$$;

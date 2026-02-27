
-- Fix: Set overtime_cap_status view to SECURITY INVOKER (default safe mode)
DROP VIEW IF EXISTS public.overtime_cap_status;
CREATE VIEW public.overtime_cap_status
WITH (security_invoker = true)
AS
SELECT oh.tenant_id, oh.employee_id, e.full_name, oh.year,
  SUM(oh.hours) AS total_annual_hours,
  COALESCE(pp.overtime_annual_cap_hours, 176) AS annual_cap,
  ROUND((SUM(oh.hours) / COALESCE(pp.overtime_annual_cap_hours, 176)) * 100, 1) AS usage_pct,
  CASE WHEN SUM(oh.hours) >= COALESCE(pp.overtime_annual_cap_hours, 176) THEN 'exceeded'
       WHEN SUM(oh.hours) >= COALESCE(pp.overtime_annual_cap_hours, 176) * 0.8 THEN 'warning'
       ELSE 'ok' END AS status
FROM overtime_hours oh
JOIN employees e ON e.id = oh.employee_id
LEFT JOIN LATERAL (SELECT overtime_annual_cap_hours FROM payroll_parameters WHERE tenant_id = oh.tenant_id ORDER BY effective_from DESC LIMIT 1) pp ON true
GROUP BY oh.tenant_id, oh.employee_id, e.full_name, oh.year, pp.overtime_annual_cap_hours;

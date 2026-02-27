
-- Fix SECURITY DEFINER views to use SECURITY INVOKER
ALTER VIEW public.v_cube_gl_entries SET (security_invoker = on);
ALTER VIEW public.v_cube_invoices SET (security_invoker = on);
ALTER VIEW public.v_cube_purchases SET (security_invoker = on);
ALTER VIEW public.v_cube_inventory_movements SET (security_invoker = on);
ALTER VIEW public.v_cube_payroll SET (security_invoker = on);
ALTER VIEW public.v_cube_pos_transactions SET (security_invoker = on);

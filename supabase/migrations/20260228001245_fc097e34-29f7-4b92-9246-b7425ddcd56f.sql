
-- Migration 1: Fix mutable search_path on 9 functions (4 SECURITY DEFINER = HIGH risk)

ALTER FUNCTION public.change_service_order_status(p_order_id uuid, p_new_status text, p_note text, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.consume_service_part(p_service_order_id uuid, p_work_order_id uuid, p_product_id uuid, p_warehouse_id uuid, p_description text, p_quantity numeric, p_unit_price numeric, p_is_warranty boolean) SET search_path = public;
ALTER FUNCTION public.create_service_intake(p_tenant_id uuid, p_intake_channel text, p_service_location_id uuid, p_origin_location_id uuid, p_partner_id uuid, p_device_id uuid, p_reported_issue text, p_priority text, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_invoice_from_service_order(p_order_id uuid) SET search_path = public;
ALTER FUNCTION public.check_device_warranty(p_device_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_service_order_number(p_tenant_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_work_order_number(p_tenant_id uuid) SET search_path = public;
ALTER FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid) SET search_path = public;
ALTER FUNCTION public.update_service_order_totals() SET search_path = public;

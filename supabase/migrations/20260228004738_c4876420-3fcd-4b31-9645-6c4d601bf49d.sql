
-- Add audit triggers to ~30 missing critical tables using existing log_audit_event()

CREATE TRIGGER audit_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_bank_reconciliations AFTER INSERT OR UPDATE OR DELETE ON public.bank_reconciliations FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_bank_statements AFTER INSERT OR UPDATE OR DELETE ON public.bank_statements FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_leave_requests AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_leave_policies AFTER INSERT OR UPDATE OR DELETE ON public.leave_policies FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fleet_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.fleet_vehicles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fleet_fuel_logs AFTER INSERT OR UPDATE OR DELETE ON public.fleet_fuel_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fleet_service_orders AFTER INSERT OR UPDATE OR DELETE ON public.fleet_service_orders FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fleet_insurance AFTER INSERT OR UPDATE OR DELETE ON public.fleet_insurance FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_lease_contracts AFTER INSERT OR UPDATE OR DELETE ON public.lease_contracts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_approval_requests AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_budgets AFTER INSERT OR UPDATE OR DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_cost_centers AFTER INSERT OR UPDATE OR DELETE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_departments AFTER INSERT OR UPDATE OR DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_locations AFTER INSERT OR UPDATE OR DELETE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_legal_entities AFTER INSERT OR UPDATE OR DELETE ON public.legal_entities FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_employee_contracts AFTER INSERT OR UPDATE OR DELETE ON public.employee_contracts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_employee_salaries AFTER INSERT OR UPDATE OR DELETE ON public.employee_salaries FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_assets AFTER INSERT OR UPDATE OR DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_goods_receipts AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_dispatch_notes AFTER INSERT OR UPDATE OR DELETE ON public.dispatch_notes FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_internal_orders AFTER INSERT OR UPDATE OR DELETE ON public.internal_orders FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_internal_transfers AFTER INSERT OR UPDATE OR DELETE ON public.internal_transfers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_inventory_write_offs AFTER INSERT OR UPDATE OR DELETE ON public.inventory_write_offs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_inventory_stock_takes AFTER INSERT OR UPDATE OR DELETE ON public.inventory_stock_takes FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_exchange_rates AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_kalkulacije AFTER INSERT OR UPDATE OR DELETE ON public.kalkulacije FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_kompenzacija AFTER INSERT OR UPDATE OR DELETE ON public.kompenzacija FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_nivelacije AFTER INSERT OR UPDATE OR DELETE ON public.nivelacije FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_advance_payments AFTER INSERT OR UPDATE OR DELETE ON public.advance_payments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

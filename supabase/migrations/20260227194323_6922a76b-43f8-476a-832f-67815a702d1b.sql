
-- Phase 1.3: Expand app_role enum with 11 new values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_rep';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'store_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_worker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production_worker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

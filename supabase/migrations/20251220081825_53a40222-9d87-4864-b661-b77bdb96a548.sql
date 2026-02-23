-- Fix overly permissive RLS policies

-- Drop the problematic "Require authentication" policies that allow any authenticated user to see all data
-- These override the more restrictive policies and expose data

-- Fix profiles table - remove overly permissive SELECT policy
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- Fix companies table - remove overly permissive SELECT policy  
DROP POLICY IF EXISTS "Require authentication for companies" ON public.companies;

-- The remaining policies properly restrict access:
-- - profiles: "Users can view own profile" restricts to own profile or admin
-- - companies: "Users can view own companies" + "Bookkeepers can view client companies" + "Admins can view all companies" handle proper access control
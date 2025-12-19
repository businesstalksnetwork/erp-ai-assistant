-- Fix profiles table RLS - remove public SELECT, require authentication
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Fix companies table RLS - ensure only owners and bookkeepers can view
DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;

-- Ensure only authenticated users who own the company or are bookkeepers can view
DROP POLICY IF EXISTS "Users can view own companies or as bookkeeper" ON public.companies;
CREATE POLICY "Users can view own companies or as bookkeeper" 
ON public.companies 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR public.is_bookkeeper_for(user_id)
);

-- Fix user_roles table RLS - only allow users to see their own roles
DROP POLICY IF EXISTS "User roles are viewable by everyone" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);
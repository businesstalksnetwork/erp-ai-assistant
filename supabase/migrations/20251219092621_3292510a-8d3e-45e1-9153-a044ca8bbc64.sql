-- Remove duplicate SELECT policy on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
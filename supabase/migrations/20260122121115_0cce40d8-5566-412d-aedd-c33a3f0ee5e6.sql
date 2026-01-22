-- Add max_companies column to profiles table
-- Default is 1 (regular users can only have 1 company)
-- Admins can update this to allow more companies
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS max_companies integer NOT NULL DEFAULT 1;
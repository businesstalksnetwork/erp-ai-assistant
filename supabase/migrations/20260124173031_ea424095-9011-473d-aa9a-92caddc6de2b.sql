-- Add email notification preference columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_reminder_day_before BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_reminder_on_due_date BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_limit_6m_warning BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_limit_8m_warning BOOLEAN DEFAULT true;
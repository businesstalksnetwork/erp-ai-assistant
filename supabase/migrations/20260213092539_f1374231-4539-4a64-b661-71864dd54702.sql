-- Add 'store' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'store';

-- Add pos_pin column to salespeople for 4-digit seller PIN
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS pos_pin text;
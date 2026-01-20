-- Add fiscal_enabled column to companies table
ALTER TABLE companies 
ADD COLUMN fiscal_enabled boolean NOT NULL DEFAULT false;
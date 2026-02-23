-- Add sef_enabled column
ALTER TABLE companies 
ADD COLUMN sef_enabled boolean NOT NULL DEFAULT false;

-- Set sef_enabled = true for companies that already have sef_api_key configured
UPDATE companies SET sef_enabled = true WHERE sef_api_key IS NOT NULL;
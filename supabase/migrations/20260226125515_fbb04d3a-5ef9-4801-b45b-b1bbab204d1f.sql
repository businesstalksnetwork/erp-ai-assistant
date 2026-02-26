-- Add ghost flag to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_ghost boolean DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN employees.is_ghost IS 'Ghost employees (super admins) are excluded from HR lists, reports, and headcounts but can access full employee features via Profile';
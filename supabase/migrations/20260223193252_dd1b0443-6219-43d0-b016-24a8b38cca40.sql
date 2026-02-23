ALTER TABLE employee_contracts
  ADD COLUMN IF NOT EXISTS position_template_id uuid REFERENCES position_templates(id);
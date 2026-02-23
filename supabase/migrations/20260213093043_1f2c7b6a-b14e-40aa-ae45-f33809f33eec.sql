ALTER TABLE employees ADD COLUMN location_id uuid REFERENCES locations(id);
CREATE INDEX idx_employees_location_id ON employees(location_id);
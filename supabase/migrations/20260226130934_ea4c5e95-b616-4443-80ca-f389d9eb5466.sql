-- Create ghost employee record for Bogdan Ciric to review profile HR sections
INSERT INTO employees (tenant_id, user_id, first_name, last_name, full_name, email, status, is_ghost, employment_type, position)
VALUES ('f726c1e8-4ad3-47c6-94b7-dfd39bfa07b8', '7b279f18-57db-4b52-aea5-e0d413a5bdaa', 'Bogdan', 'Ciric', 'Bogdan Ciric', 'bogdan@aiitdevelopment.com', 'active', true, 'full_time', 'Super Admin')
ON CONFLICT DO NOTHING;
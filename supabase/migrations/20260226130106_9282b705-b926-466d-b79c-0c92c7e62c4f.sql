-- Create ghost employee records for super admins
INSERT INTO employees (tenant_id, user_id, first_name, last_name, full_name, email, status, is_ghost, employment_type, position)
VALUES 
  ('92474a4b-ff91-48da-b111-89924e70b8b8', 'ca7a0290-81a2-42d7-94c4-49e43224304c', 'Aleksandar', 'Admin', 'Aleksandar Admin', 'aleksandar@aiitdevelopment.com', 'active', true, 'full_time', 'Super Admin'),
  ('92474a4b-ff91-48da-b111-89924e70b8b8', 'c7a1498b-7f32-4966-8809-5435a229a149', 'Nikola', 'Admin', 'Nikola Admin', 'nikola@aiitdevelopment.com', 'active', true, 'full_time', 'Super Admin')
ON CONFLICT DO NOTHING;
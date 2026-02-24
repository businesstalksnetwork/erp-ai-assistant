
INSERT INTO public.user_roles (user_id, role)
VALUES ('ca7a0290-81a2-42d7-94c4-49e43224304c', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

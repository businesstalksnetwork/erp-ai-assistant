
ALTER TABLE public.partners DISABLE TRIGGER audit_partners;

DELETE FROM public.partners 
WHERE id IN (
  SELECT id FROM public.partners 
  WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822' 
  LIMIT 3000
);

DELETE FROM public.partners 
WHERE id IN (
  SELECT id FROM public.partners 
  WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822' 
  LIMIT 3000
);

DELETE FROM public.partners 
WHERE id IN (
  SELECT id FROM public.partners 
  WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822' 
  LIMIT 3000
);

DELETE FROM public.partners 
WHERE id IN (
  SELECT id FROM public.partners 
  WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822' 
  LIMIT 3000
);

DELETE FROM public.partners 
WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';

ALTER TABLE public.partners ENABLE TRIGGER audit_partners;

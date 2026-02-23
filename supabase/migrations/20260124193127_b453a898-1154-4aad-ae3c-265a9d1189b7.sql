CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invited_by UUID;
BEGIN
  -- Parse invited_by_user_id if provided
  v_invited_by := NULLIF(NEW.raw_user_meta_data->>'invited_by_user_id', '')::uuid;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    pib, 
    company_name, 
    account_type,
    agency_name,
    agency_pib,
    status, 
    subscription_end, 
    is_trial,
    invited_by_user_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'pib',
    NEW.raw_user_meta_data->>'company_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal'),
    NEW.raw_user_meta_data->>'agency_name',
    NEW.raw_user_meta_data->>'agency_pib',
    'approved',
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal') = 'bookkeeper' 
        THEN NULL
      ELSE CURRENT_DATE + INTERVAL '14 days'
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal') = 'bookkeeper' 
        THEN false
      ELSE true 
    END,
    v_invited_by
  );
  
  -- Create referral record if this user was invited by a bookkeeper
  IF v_invited_by IS NOT NULL THEN
    INSERT INTO public.bookkeeper_referrals (bookkeeper_id, client_id)
    VALUES (v_invited_by, NEW.id)
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
-- Update create_bookkeeper_earning function to skip admin users
CREATE OR REPLACE FUNCTION public.create_bookkeeper_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bookkeeper_id UUID;
  v_is_admin BOOLEAN;
  v_commission_rate NUMERIC := 0.20; -- 20%
BEGIN
  -- Find if this user was referred by a bookkeeper
  SELECT invited_by_user_id INTO v_bookkeeper_id
  FROM profiles
  WHERE id = NEW.user_id
    AND invited_by_user_id IS NOT NULL;
  
  -- If there's a referrer bookkeeper, check if they are admin
  IF v_bookkeeper_id IS NOT NULL THEN
    -- Check if bookkeeper is admin (admins don't earn commissions)
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = v_bookkeeper_id AND role = 'admin'
    ) INTO v_is_admin;
    
    -- Only create earnings if bookkeeper is NOT an admin
    IF NOT v_is_admin THEN
      INSERT INTO bookkeeper_earnings (
        bookkeeper_id,
        client_id,
        payment_month,
        client_payment_amount,
        commission_rate,
        commission_amount,
        status
      ) VALUES (
        v_bookkeeper_id,
        NEW.user_id,
        DATE_TRUNC('month', NEW.payment_date)::DATE,
        NEW.amount,
        v_commission_rate,
        NEW.amount * v_commission_rate,
        'pending'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
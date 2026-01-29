-- Create verification_tokens table for custom email verification
CREATE TABLE public.verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX idx_verification_tokens_token ON public.verification_tokens(token);
CREATE INDEX idx_verification_tokens_user_id ON public.verification_tokens(user_id);

-- Enable RLS - only service role can access (edge functions use service role)
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- Insert email verification template
INSERT INTO public.email_templates (template_key, name, subject, html_content, description, placeholders)
VALUES (
  'email_verification',
  'Verifikacija email adrese',
  'Potvrdite vašu email adresu - PausalBox',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #2563eb; margin: 0;">PausalBox</h1>
    </div>
    <h2 style="color: #333; margin-bottom: 20px;">Dobrodošli u PausalBox!</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">Poštovani {{full_name}},</p>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">Hvala vam što ste se registrovali. Da biste aktivirali vaš nalog, molimo vas da potvrdite vašu email adresu klikom na dugme ispod:</p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="{{verification_url}}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Potvrdi email adresu</a>
    </div>
    <p style="color: #888; font-size: 14px;">Ako dugme ne radi, kopirajte ovaj link u browser:</p>
    <p style="color: #2563eb; font-size: 13px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 6px;">{{verification_url}}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
    <p style="color: #999; font-size: 12px; text-align: center;">Link ističe za 24 sata.</p>
    <p style="color: #999; font-size: 12px; text-align: center;">Ako niste Vi napravili nalog, slobodno ignorišite ovaj email.</p>
  </div>',
  'Template za verifikaciju email adrese prilikom registracije',
  ARRAY['full_name', 'verification_url']
);
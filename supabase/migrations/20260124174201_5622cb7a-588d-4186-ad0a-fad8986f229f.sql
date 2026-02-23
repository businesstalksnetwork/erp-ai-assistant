-- Add new email preference columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_reminder_7_days_before BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_subscription_warnings BOOLEAN DEFAULT true;

-- Create email templates table for admin customization
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  description TEXT,
  placeholders TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates
INSERT INTO public.email_templates (template_key, name, subject, html_content, description, placeholders) VALUES
-- Reminder templates
('reminder_7_days', 'Podsetnik - 7 dana pre', 'Podsetnik: {{reminder_title}} - rok za 7 dana', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Podsećamo vas da imate obavezu koja dospeva za <strong>7 dana</strong>.</p>
  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #1a1a2e;">{{reminder_title}}</h3>
    <p style="margin: 5px 0;"><strong>Rok:</strong> {{due_date}}</p>
    {{#if amount}}<p style="margin: 5px 0;"><strong>Iznos:</strong> {{amount}}</p>{{/if}}
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za više detalja.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili email podsetnike u podešavanjima.</p>
</div>',
'Šalje se 7 dana pre roka obaveze',
ARRAY['full_name', 'reminder_title', 'due_date', 'amount']),

('reminder_day_before', 'Podsetnik - dan pre', 'Podsetnik: {{reminder_title}} - rok je sutra!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Podsećamo vas da imate obavezu koja dospeva <strong>sutra</strong>.</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <h3 style="margin: 0 0 10px 0; color: #1a1a2e;">{{reminder_title}}</h3>
    <p style="margin: 5px 0;"><strong>Rok:</strong> {{due_date}}</p>
    {{#if amount}}<p style="margin: 5px 0;"><strong>Iznos:</strong> {{amount}}</p>{{/if}}
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za više detalja.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili email podsetnike u podešavanjima.</p>
</div>',
'Šalje se dan pre roka obaveze',
ARRAY['full_name', 'reminder_title', 'due_date', 'amount']),

('reminder_on_due_date', 'Podsetnik - na dan roka', 'HITNO: {{reminder_title}} - rok je danas!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p style="color: #dc3545;"><strong>Rok za vašu obavezu je DANAS!</strong></p>
  <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <h3 style="margin: 0 0 10px 0; color: #1a1a2e;">{{reminder_title}}</h3>
    <p style="margin: 5px 0;"><strong>Rok:</strong> {{due_date}}</p>
    {{#if amount}}<p style="margin: 5px 0;"><strong>Iznos:</strong> {{amount}}</p>{{/if}}
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za više detalja.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili email podsetnike u podešavanjima.</p>
</div>',
'Šalje se na dan roka obaveze',
ARRAY['full_name', 'reminder_title', 'due_date', 'amount']),

-- Trial expiring templates
('trial_expiring_7_days', 'Trial ističe - 7 dana', 'Vaš probni period ističe za 7 dana', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Vaš <strong>probni period</strong> na PausalBox-u ističe za <strong>7 dana</strong> ({{subscription_end_date}}).</p>
  <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
    <p style="margin: 0;">Aktivirajte pretplatu da nastavite da koristite sve funkcionalnosti aplikacije.</p>
  </div>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Aktiviraj pretplatu</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se 7 dana pre isteka trial perioda',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

('trial_expiring_3_days', 'Trial ističe - 3 dana', 'Vaš probni period ističe za 3 dana', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Vaš <strong>probni period</strong> na PausalBox-u ističe za <strong>3 dana</strong> ({{subscription_end_date}}).</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 0;">Još uvek imate vremena da aktivirate pretplatu i nastavite sa radom.</p>
  </div>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Aktiviraj pretplatu</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se 3 dana pre isteka trial perioda',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

('trial_expiring_1_day', 'Trial ističe - sutra', 'HITNO: Vaš probni period ističe sutra!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p style="color: #dc3545;"><strong>Vaš probni period ističe SUTRA!</strong></p>
  <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <p style="margin: 0;">Datum isteka: <strong>{{subscription_end_date}}</strong></p>
  </div>
  <p>Aktivirajte pretplatu sada da ne izgubite pristup vašim podacima.</p>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Aktiviraj pretplatu odmah</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se dan pre isteka trial perioda',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

-- Subscription expiring templates
('subscription_expiring_7_days', 'Pretplata ističe - 7 dana', 'Vaša pretplata ističe za 7 dana', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Vaša <strong>pretplata</strong> na PausalBox-u ističe za <strong>7 dana</strong> ({{subscription_end_date}}).</p>
  <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
    <p style="margin: 0;">Produžite pretplatu da nastavite da koristite sve funkcionalnosti aplikacije.</p>
  </div>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Produži pretplatu</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se 7 dana pre isteka pretplate',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

('subscription_expiring_3_days', 'Pretplata ističe - 3 dana', 'Vaša pretplata ističe za 3 dana', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Vaša <strong>pretplata</strong> na PausalBox-u ističe za <strong>3 dana</strong> ({{subscription_end_date}}).</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 0;">Još uvek imate vremena da produžite pretplatu.</p>
  </div>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Produži pretplatu</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se 3 dana pre isteka pretplate',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

('subscription_expiring_1_day', 'Pretplata ističe - sutra', 'HITNO: Vaša pretplata ističe sutra!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p style="color: #dc3545;"><strong>Vaša pretplata ističe SUTRA!</strong></p>
  <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <p style="margin: 0;">Datum isteka: <strong>{{subscription_end_date}}</strong></p>
  </div>
  <p>Produžite pretplatu sada da ne izgubite pristup vašim podacima.</p>
  <p><a href="https://pausalbox.lovable.app/profile" style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Produži pretplatu odmah</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o pretplati u podešavanjima.</p>
</div>',
'Šalje se dan pre isteka pretplate',
ARRAY['full_name', 'subscription_end_date', 'days_left']),

-- Limit warning templates
('limit_80_6m', 'Limit 6M - 80%', 'Upozorenje: Dostigli ste 80% godišnjeg limita od 6M RSD', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Dostigli ste <strong>80%</strong> godišnjeg limita od 6 miliona dinara.</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 5px 0;"><strong>Trenutni promet:</strong> {{current_amount}}</p>
    <p style="margin: 5px 0;"><strong>Limit:</strong> {{limit_amount}}</p>
    <p style="margin: 5px 0;"><strong>Preostalo:</strong> {{remaining_amount}}</p>
    <p style="margin: 5px 0;"><strong>Iskorišćeno:</strong> {{limit_percent}}%</p>
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za detaljan pregled.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o limitima u podešavanjima.</p>
</div>',
'Šalje se kada korisnik dostigne 80% godišnjeg limita od 6M',
ARRAY['full_name', 'current_amount', 'limit_amount', 'remaining_amount', 'limit_percent']),

('limit_90_6m', 'Limit 6M - 90%', 'HITNO: Dostigli ste 90% godišnjeg limita od 6M RSD!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p style="color: #dc3545;"><strong>Dostigli ste 90% godišnjeg limita od 6 miliona dinara!</strong></p>
  <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <p style="margin: 5px 0;"><strong>Trenutni promet:</strong> {{current_amount}}</p>
    <p style="margin: 5px 0;"><strong>Limit:</strong> {{limit_amount}}</p>
    <p style="margin: 5px 0;"><strong>Preostalo:</strong> {{remaining_amount}}</p>
    <p style="margin: 5px 0;"><strong>Iskorišćeno:</strong> {{limit_percent}}%</p>
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za detaljan pregled i planiranje.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o limitima u podešavanjima.</p>
</div>',
'Šalje se kada korisnik dostigne 90% godišnjeg limita od 6M',
ARRAY['full_name', 'current_amount', 'limit_amount', 'remaining_amount', 'limit_percent']),

('limit_80_8m', 'Limit 8M - 80%', 'Upozorenje: Dostigli ste 80% kliznog limita od 8M RSD', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p>Dostigli ste <strong>80%</strong> kliznog limita od 8 miliona dinara (poslednjih 365 dana).</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 5px 0;"><strong>Trenutni promet (domaći):</strong> {{current_amount}}</p>
    <p style="margin: 5px 0;"><strong>Limit:</strong> {{limit_amount}}</p>
    <p style="margin: 5px 0;"><strong>Preostalo:</strong> {{remaining_amount}}</p>
    <p style="margin: 5px 0;"><strong>Iskorišćeno:</strong> {{limit_percent}}%</p>
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za detaljan pregled.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o limitima u podešavanjima.</p>
</div>',
'Šalje se kada korisnik dostigne 80% kliznog limita od 8M (domaći promet)',
ARRAY['full_name', 'current_amount', 'limit_amount', 'remaining_amount', 'limit_percent']),

('limit_90_8m', 'Limit 8M - 90%', 'HITNO: Dostigli ste 90% kliznog limita od 8M RSD!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">Poštovani {{full_name}},</h2>
  <p style="color: #dc3545;"><strong>Dostigli ste 90% kliznog limita od 8 miliona dinara!</strong></p>
  <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <p style="margin: 5px 0;"><strong>Trenutni promet (domaći):</strong> {{current_amount}}</p>
    <p style="margin: 5px 0;"><strong>Limit:</strong> {{limit_amount}}</p>
    <p style="margin: 5px 0;"><strong>Preostalo:</strong> {{remaining_amount}}</p>
    <p style="margin: 5px 0;"><strong>Iskorišćeno:</strong> {{limit_percent}}%</p>
  </div>
  <p>Prijavite se na <a href="https://pausalbox.lovable.app" style="color: #6366f1;">PausalBox</a> za detaljan pregled i planiranje.</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Ovu poruku ste primili jer ste uključili upozorenja o limitima u podešavanjima.</p>
</div>',
'Šalje se kada korisnik dostigne 90% kliznog limita od 8M (domaći promet)',
ARRAY['full_name', 'current_amount', 'limit_amount', 'remaining_amount', 'limit_percent']);
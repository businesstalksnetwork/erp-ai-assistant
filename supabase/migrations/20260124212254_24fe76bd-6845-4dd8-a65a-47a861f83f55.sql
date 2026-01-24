-- Add email settings columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS auto_send_invoice_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_signature_sr TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_signature_en TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.auto_send_invoice_email IS 'When true, automatically opens send email dialog after creating an invoice';
COMMENT ON COLUMN public.companies.email_signature_sr IS 'Custom email signature in Serbian (supports HTML)';
COMMENT ON COLUMN public.companies.email_signature_en IS 'Custom email signature in English (supports HTML)';

-- Update email templates to include signature placeholder
UPDATE public.email_templates 
SET html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333;">Poštovani,</h2>
    <p>U prilogu se nalazi <strong>{{document_type}}</strong> broj <strong>{{invoice_number}}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px 0; color: #666;">Datum izdavanja:</td><td style="font-weight: bold;">{{issue_date}}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Rok plaćanja:</td><td style="font-weight: bold;">{{payment_deadline}}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Iznos za uplatu:</td><td style="font-weight: bold;">{{total_amount}}</td></tr>
    </table>
    <p>Fakturu možete preuzeti klikom na link ispod:</p>
    <p><a href="{{pdf_url}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Preuzmi PDF</a></p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
    <p style="color: #666;">S poštovanjem,<br/><strong>{{company_name}}</strong></p>
    {{signature}}
  </div>'
WHERE template_key = 'invoice_send_sr';

UPDATE public.email_templates 
SET html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333;">Dear Client,</h2>
    <p>Please find attached <strong>{{document_type}}</strong> number <strong>{{invoice_number}}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px 0; color: #666;">Issue date:</td><td style="font-weight: bold;">{{issue_date}}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Payment due:</td><td style="font-weight: bold;">{{payment_deadline}}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Amount due:</td><td style="font-weight: bold;">{{total_amount}}</td></tr>
    </table>
    <p>You can download the invoice by clicking the button below:</p>
    <p><a href="{{pdf_url}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Download PDF</a></p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
    <p style="color: #666;">Best regards,<br/><strong>{{company_name}}</strong></p>
    {{signature}}
  </div>'
WHERE template_key = 'invoice_send_en';
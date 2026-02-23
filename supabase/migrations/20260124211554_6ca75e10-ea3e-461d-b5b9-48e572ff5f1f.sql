-- Add email column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- Create invoice_email_log table for tracking sent emails
CREATE TABLE IF NOT EXISTS public.invoice_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  language TEXT DEFAULT 'sr',
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on invoice_email_log
ALTER TABLE public.invoice_email_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_email_log
CREATE POLICY "Users can view own company email logs" ON public.invoice_email_log
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.is_company_bookkeeper(company_id)
  );

CREATE POLICY "Users can insert own company email logs" ON public.invoice_email_log
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Create invoice-pdfs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoice-pdfs bucket
CREATE POLICY "Users can upload invoice PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'invoice-pdfs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own invoice PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoice-pdfs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own invoice PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'invoice-pdfs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Insert Serbian email template
INSERT INTO public.email_templates (template_key, name, subject, html_content)
VALUES (
  'invoice_send_sr',
  'Slanje fakture - Srpski',
  'Faktura {{invoice_number}} - {{company_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="color: #111827; margin-top: 0;">Poštovani,</h2>
      <p style="color: #374151; line-height: 1.6;">U prilogu se nalazi <strong>{{document_type}}</strong> broj <strong>{{invoice_number}}</strong>.</p>
      <table style="margin: 24px 0; border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Datum izdavanja:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb; text-align: right;">{{issue_date}}</td></tr>
        <tr><td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Rok plaćanja:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb; text-align: right;">{{payment_deadline}}</td></tr>
        <tr><td style="padding: 12px 0; color: #6b7280;">Iznos za uplatu:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; text-align: right; font-size: 18px;">{{total_amount}}</td></tr>
      </table>
      <p style="color: #374151; line-height: 1.6;">Fakturu možete preuzeti klikom na dugme ispod:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{pdf_url}}" style="display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Preuzmi PDF</a>
      </p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"/>
      <p style="color: #6b7280; margin-bottom: 0;">S poštovanjem,<br/><strong style="color: #111827;">{{company_name}}</strong></p>
    </div>
  </div>'
)
ON CONFLICT (template_key) DO NOTHING;

-- Insert English email template
INSERT INTO public.email_templates (template_key, name, subject, html_content)
VALUES (
  'invoice_send_en',
  'Slanje fakture - Engleski',
  'Invoice {{invoice_number}} - {{company_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="color: #111827; margin-top: 0;">Dear Client,</h2>
      <p style="color: #374151; line-height: 1.6;">Please find attached <strong>{{document_type}}</strong> number <strong>{{invoice_number}}</strong>.</p>
      <table style="margin: 24px 0; border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Issue date:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb; text-align: right;">{{issue_date}}</td></tr>
        <tr><td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Payment due:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb; text-align: right;">{{payment_deadline}}</td></tr>
        <tr><td style="padding: 12px 0; color: #6b7280;">Amount due:</td><td style="padding: 12px 0; font-weight: 600; color: #111827; text-align: right; font-size: 18px;">{{total_amount}}</td></tr>
      </table>
      <p style="color: #374151; line-height: 1.6;">You can download the invoice by clicking the button below:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{pdf_url}}" style="display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Download PDF</a>
      </p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"/>
      <p style="color: #6b7280; margin-bottom: 0;">Best regards,<br/><strong style="color: #111827;">{{company_name}}</strong></p>
    </div>
  </div>'
)
ON CONFLICT (template_key) DO NOTHING;
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

interface SendInvoiceRequest {
  invoiceId: string;
  recipientEmail: string;
  language: 'sr' | 'en';
  pdfUrl: string;
  ccToSender?: boolean;
  senderEmail?: string;
}

// Format date based on language
function formatDate(dateStr: string, language: 'sr' | 'en'): string {
  const date = new Date(dateStr);
  if (language === 'en') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('sr-Latn-RS', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format currency based on language and currency code
function formatCurrency(amount: number, currency: string | null, language: 'sr' | 'en'): string {
  const curr = currency || 'RSD';
  const locale = language === 'en' ? 'en-US' : 'sr-Latn-RS';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: curr === 'RSD' ? 0 : 2,
    maximumFractionDigits: curr === 'RSD' ? 0 : 2,
  }).format(amount);
}

// Replace template placeholders
function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  console.log("send-invoice-email function called");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const resend = new Resend(resendApiKey);

    const body: SendInvoiceRequest = await req.json();
    console.log("Request body:", JSON.stringify({ ...body, pdfUrl: '[redacted]' }));

    const { invoiceId, recipientEmail, language, pdfUrl, ccToSender, senderEmail } = body;

    // Validate required fields
    if (!invoiceId || !recipientEmail || !language || !pdfUrl) {
      throw new Error("Missing required fields: invoiceId, recipientEmail, language, pdfUrl");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error("Invalid email format");
    }

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError);
      throw new Error("Invoice not found");
    }

    console.log("Invoice found:", invoice.invoice_number);

    // Fetch company data with email signatures
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, email_signature_sr, email_signature_en')
      .eq('id', invoice.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company fetch error:", companyError);
      throw new Error("Company not found");
    }

    console.log("Company found:", company.name);

    // Get appropriate signature based on language
    const signature = language === 'en' 
      ? (company.email_signature_en || '') 
      : (company.email_signature_sr || '');

    // Fetch email template
    const templateKey = language === 'en' ? 'invoice_send_en' : 'invoice_send_sr';
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, html_content')
      .eq('template_key', templateKey)
      .single();

    if (templateError || !template) {
      console.error("Template fetch error:", templateError);
      throw new Error(`Email template '${templateKey}' not found`);
    }

    console.log("Template found:", templateKey);

    // Prepare template data
    const documentTypeMap = {
      sr: { regular: 'faktura', proforma: 'predračun', advance: 'avansna faktura' },
      en: { regular: 'invoice', proforma: 'proforma invoice', advance: 'advance invoice' }
    };

    const invoiceType = invoice.invoice_type || (invoice.is_proforma ? 'proforma' : 'regular');
    const documentType = documentTypeMap[language][invoiceType as keyof typeof documentTypeMap.sr] || documentTypeMap[language].regular;

    // Calculate amount to display
    const displayAmount = invoice.foreign_amount && invoice.foreign_currency
      ? formatCurrency(invoice.foreign_amount, invoice.foreign_currency, language)
      : formatCurrency(invoice.total_amount, 'RSD', language);

    // Prepare signature HTML
    const signatureHtml = signature ? `<div style="margin-top: 16px; white-space: pre-wrap;">${signature}</div>` : '';

    // Generate tracking URL
    const trackingToken = crypto.randomUUID();
    const trackingUrl = `${supabaseUrl}/functions/v1/track-invoice-view?token=${trackingToken}`;

    const templateData = {
      invoice_number: invoice.invoice_number,
      company_name: company.name,
      document_type: documentType,
      issue_date: formatDate(invoice.issue_date, language),
      payment_deadline: invoice.payment_deadline ? formatDate(invoice.payment_deadline, language) : '-',
      total_amount: displayAmount,
      pdf_url: trackingUrl,
      signature: signatureHtml,
    };

    // Render email content
    const subject = renderTemplate(template.subject, templateData);
    const htmlContent = renderTemplate(template.html_content, templateData);

    console.log("Sending email to:", recipientEmail);

    // Build recipients list
    const recipients = [recipientEmail];
    
    // Send email via Resend
    const emailPayload: {
      from: string;
      to: string[];
      cc?: string[];
      subject: string;
      html: string;
    } = {
      from: `${company.name} <no-reply@erp-ai-assistant.rs>`,
      to: recipients,
      subject: subject,
      html: htmlContent,
    };

    // Add CC if requested and sender email provided
    if (ccToSender && senderEmail && emailRegex.test(senderEmail)) {
      emailPayload.cc = [senderEmail];
    }

    const emailResponse = await resend.emails.send(emailPayload);

    // Check if Resend returned an error
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully, ID:", emailResponse.data?.id);

    // Log the email in database
    const { data: emailLog, error: logError } = await supabase
      .from('invoice_email_log')
      .insert({
        invoice_id: invoiceId,
        company_id: invoice.company_id,
        sent_to: recipientEmail,
        language: language,
        status: 'sent',
      })
      .select('id')
      .single();

    if (logError) {
      console.error("Failed to log email:", logError);
    }

    // Create trackable view record using the same token from the URL
    try {
      await supabase.from('invoice_views').insert({
        invoice_id: invoiceId,
        company_id: invoice.company_id,
        email_log_id: emailLog?.id || null,
        tracking_token: trackingToken,
        pdf_url: pdfUrl,
      });
      console.log("Tracking record created with token:", trackingToken);
    } catch (trackErr) {
      console.error("Failed to create tracking record:", trackErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: withSecurityHeaders({ "Content-Type": "application/json", ...corsHeaders }),
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-invoice-email:", error);
    const safeMessage = "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: safeMessage }),
      {
        status: 500,
        headers: withSecurityHeaders({ "Content-Type": "application/json", ...corsHeaders }),
      }
    );
  }
};

serve(handler);

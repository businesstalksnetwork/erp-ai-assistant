import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmailLog {
  id: string;
  invoice_id: string;
  company_id: string;
  sent_to: string;
  sent_at: string;
  language: 'sr' | 'en';
  status: 'sent' | 'failed';
  error_message?: string;
}

interface SendInvoiceEmailParams {
  invoiceId: string;
  companyId: string;
  recipientEmail: string;
  language: 'sr' | 'en';
  pdfBlob: Blob;
  ccToSender?: boolean;
  senderEmail?: string;
}

export function useInvoiceEmail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendInvoiceEmail = useMutation({
    mutationFn: async ({
      invoiceId,
      companyId,
      recipientEmail,
      language,
      pdfBlob,
      ccToSender,
      senderEmail,
    }: SendInvoiceEmailParams) => {
      console.log('Starting invoice email send process...');
      
      // 1. Upload PDF to Supabase Storage
      const pdfPath = `${companyId}/${invoiceId}-${Date.now()}.pdf`;
      console.log('Uploading PDF to:', pdfPath);
      
      const { error: uploadError } = await supabase.storage
        .from('invoice-pdfs')
        .upload(pdfPath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('PDF upload error:', uploadError);
        throw new Error('Greška pri uploadu PDF-a: ' + uploadError.message);
      }

      // 2. Get signed URL (valid for 7 days)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('invoice-pdfs')
        .createSignedUrl(pdfPath, 60 * 60 * 24 * 7); // 7 days

      if (urlError || !urlData?.signedUrl) {
        console.error('Signed URL error:', urlError);
        throw new Error('Greška pri kreiranju linka za PDF');
      }

      console.log('PDF uploaded, calling edge function...');

      // 3. Call edge function to send email
      const { data, error: functionError } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId,
          recipientEmail,
          language,
          pdfUrl: urlData.signedUrl,
          ccToSender,
          senderEmail,
        },
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error('Greška pri slanju emaila: ' + functionError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Nepoznata greška pri slanju emaila');
      }

      console.log('Email sent successfully');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-email-log', variables.invoiceId] });
      toast({
        title: 'Email poslat',
        description: `Faktura je uspešno poslata na ${variables.recipientEmail}`,
      });
    },
    onError: (error: Error) => {
      console.error('Send invoice email error:', error);
      toast({
        title: 'Greška pri slanju',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    sendInvoiceEmail,
  };
}

export function useEmailHistory(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-email-log', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from('invoice_email_log')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Email history fetch error:', error);
        throw error;
      }

      return data as EmailLog[];
    },
    enabled: !!invoiceId,
  });
}

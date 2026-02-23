// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/storage';

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
      
      // Convert Blob to File for upload
      const pdfFile = new File([pdfBlob], `invoice-${invoiceId}.pdf`, { type: 'application/pdf' });
      
      // 1. Upload PDF to DigitalOcean Spaces via edge function
      console.log('Uploading PDF to DigitalOcean Spaces...');
      
      const uploadResult = await uploadFile({
        type: 'invoice',
        companyId,
        file: pdfFile,
        invoiceId,
      });

      if (!uploadResult.success) {
        console.error('PDF upload error:', uploadResult.error);
        throw new Error('Greška pri uploadu PDF-a: ' + uploadResult.error);
      }

      // 2. Get signed URL for the uploaded PDF (valid for 7 days)
      const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke('storage-download', {
        body: { 
          path: uploadResult.path,
          expiresIn: 60 * 60 * 24 * 7 // 7 days
        },
      });

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Signed URL error:', signedUrlError || signedUrlData?.error);
        throw new Error('Greška pri kreiranju linka za PDF');
      }

      console.log('PDF uploaded, calling edge function...');

      // 3. Call edge function to send email
      const { data, error: functionError } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId,
          recipientEmail,
          language,
          pdfUrl: signedUrlData.signedUrl,
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

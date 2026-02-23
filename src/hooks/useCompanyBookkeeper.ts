// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useCompanyBookkeeper() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Invite bookkeeper to a specific company
  const inviteBookkeeper = useMutation({
    mutationFn: async ({ companyId, email }: { companyId: string; email: string }) => {
      const { data, error } = await supabase
        .from('companies')
        .update({
          bookkeeper_email: email.toLowerCase().trim(),
          bookkeeper_status: 'pending',
          bookkeeper_invited_at: new Date().toISOString(),
          bookkeeper_id: null, // Reset in case of re-invite
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['selected-company'] });
      toast({ title: 'Pozivnica je poslata knjigovođi' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel pending invitation
  const cancelInvitation = useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase
        .from('companies')
        .update({
          bookkeeper_email: null,
          bookkeeper_status: null,
          bookkeeper_invited_at: null,
          bookkeeper_id: null,
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['selected-company'] });
      toast({ title: 'Pozivnica je otkazana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Remove bookkeeper access (for accepted invitations)
  const removeBookkeeper = useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase
        .from('companies')
        .update({
          bookkeeper_email: null,
          bookkeeper_status: null,
          bookkeeper_invited_at: null,
          bookkeeper_id: null,
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['selected-company'] });
      toast({ title: 'Pristup knjigovođi je uklonjen' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Accept invitation (for bookkeeper)
  const acceptInvitation = useMutation({
    mutationFn: async (companyId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Niste prijavljeni');

      const { data, error } = await supabase
        .from('companies')
        .update({
          bookkeeper_id: userData.user.id,
          bookkeeper_status: 'accepted',
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-received'] });
      toast({ title: 'Pozivnica je prihvaćena' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Reject invitation (for bookkeeper)
  const rejectInvitation = useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase
        .from('companies')
        .update({
          bookkeeper_status: 'rejected',
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-received'] });
      toast({ title: 'Pozivnica je odbijena' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  return {
    inviteBookkeeper,
    cancelInvitation,
    removeBookkeeper,
    acceptInvitation,
    rejectInvitation,
  };
}

// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface BookkeeperInvitation {
  id: string;
  client_id: string;
  bookkeeper_id: string | null;
  bookkeeper_email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  client_email?: string;
}

export function useBookkeeperInvitations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get invitations I sent (as a client)
  const { data: sentInvitations = [], isLoading: loadingSent } = useQuery({
    queryKey: ['bookkeeper-invitations-sent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookkeeper_clients')
        .select('*')
        .eq('client_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BookkeeperInvitation[];
    },
    enabled: !!user,
  });

  // Get invitations sent to me (as a bookkeeper)
  const { data: receivedInvitations = [], isLoading: loadingReceived } = useQuery({
    queryKey: ['bookkeeper-invitations-received', user?.email],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user!.id)
        .single();

      if (!profile?.email) return [];

      const { data, error } = await supabase
        .from('bookkeeper_clients')
        .select('*')
        .eq('bookkeeper_email', profile.email)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch client profiles for names
      const clientIds = data.map(inv => inv.client_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', clientIds);

      return data.map(inv => ({
        ...inv,
        client_name: profiles?.find(p => p.id === inv.client_id)?.full_name,
        client_email: profiles?.find(p => p.id === inv.client_id)?.email,
      })) as BookkeeperInvitation[];
    },
    enabled: !!user,
  });

  // Send invitation to bookkeeper
  const sendInvitation = useMutation({
    mutationFn: async (bookkeeper_email: string) => {
      const { data, error } = await supabase
        .from('bookkeeper_clients')
        .insert({
          client_id: user!.id,
          bookkeeper_email: bookkeeper_email.toLowerCase().trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-sent'] });
    },
  });

  // Accept/Reject invitation
  const respondToInvitation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'accepted' | 'rejected' }) => {
      const { data, error } = await supabase
        .from('bookkeeper_clients')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-received'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  // Cancel invitation (pending)
  const cancelInvitation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookkeeper_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-sent'] });
    },
  });

  // Remove bookkeeper access (for accepted invitations)
  const removeBookkeeper = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookkeeper_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookkeeper-invitations-sent'] });
    },
  });

  // Get my clients (as a bookkeeper)
  const { data: myClients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['my-bookkeeper-clients', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user!.id)
        .single();

      if (!profile?.email) return [];

      const { data, error } = await supabase
        .from('bookkeeper_clients')
        .select('*')
        .eq('bookkeeper_email', profile.email)
        .eq('status', 'accepted');

      if (error) throw error;

      // Fetch client profiles
      const clientIds = data.map(inv => inv.client_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', clientIds);

      return data.map(inv => ({
        ...inv,
        client_name: profiles?.find(p => p.id === inv.client_id)?.full_name,
        client_email: profiles?.find(p => p.id === inv.client_id)?.email,
      })) as BookkeeperInvitation[];
    },
    enabled: !!user,
  });

  return {
    sentInvitations,
    receivedInvitations,
    myClients,
    isLoading: loadingSent || loadingReceived || loadingClients,
    sendInvitation,
    respondToInvitation,
    cancelInvitation,
    removeBookkeeper,
  };
}

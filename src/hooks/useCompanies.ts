import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Company {
  id: string;
  user_id: string;
  name: string;
  address: string;
  pib: string;
  maticni_broj: string;
  bank_account: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // For client companies
  is_client_company?: boolean;
  client_name?: string;
}

export function useCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch my own companies
  const { data: myCompanies = [], isLoading: loadingMy } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Company[];
    },
    enabled: !!user,
  });

  // Fetch client companies (as bookkeeper)
  const { data: clientCompanies = [], isLoading: loadingClients } = useQuery({
    queryKey: ['client-companies', user?.id],
    queryFn: async () => {
      // First get my email from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user!.id)
        .single();

      if (!profile?.email) return [];

      // Get accepted client relationships
      const { data: clientRelations, error: relError } = await supabase
        .from('bookkeeper_clients')
        .select('client_id')
        .eq('bookkeeper_email', profile.email)
        .eq('status', 'accepted');

      if (relError || !clientRelations?.length) return [];

      const clientIds = clientRelations.map(r => r.client_id);

      // Get client profiles for names
      const { data: clientProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', clientIds);

      // Get companies for all clients
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .in('user_id', clientIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mark these as client companies and add client name
      return (companies || []).map(company => ({
        ...company,
        is_client_company: true,
        client_name: clientProfiles?.find(p => p.id === company.user_id)?.full_name || 
                    clientProfiles?.find(p => p.id === company.user_id)?.email || 
                    'Klijent',
      })) as Company[];
    },
    enabled: !!user,
  });

  // Combine all companies
  const companies = [...myCompanies, ...clientCompanies];

  const createCompany = useMutation({
    mutationFn: async (company: Omit<Company, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_client_company' | 'client_name' | 'logo_url'> & { logo_url?: string | null }) => {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          ...company,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Firma je uspešno kreirana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, ...company }: Partial<Company> & { id: string }) => {
      const { data, error } = await supabase
        .from('companies')
        .update(company)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Firma je ažurirana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Firma je obrisana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  return {
    companies,
    myCompanies,
    clientCompanies,
    isLoading: loadingMy || loadingClients,
    createCompany,
    updateCompany,
    deleteCompany,
  };
}

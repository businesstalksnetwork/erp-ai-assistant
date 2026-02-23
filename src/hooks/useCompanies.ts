// @ts-nocheck
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Company {
  id: string;
  user_id: string;
  name: string;
  address: string;
  city: string | null;
  country: string | null;
  pib: string;
  maticni_broj: string;
  bank_account: string | null;
  logo_url: string | null;
  // SECURITY: sef_api_key is NOT included - use has_sef_api_key boolean instead
  has_sef_api_key: boolean;
  sef_enabled: boolean;
  fiscal_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Bookkeeper fields
  bookkeeper_email?: string | null;
  bookkeeper_id?: string | null;
  bookkeeper_status?: 'pending' | 'accepted' | 'rejected' | null;
  bookkeeper_invited_at?: string | null;
  // For client companies
  is_client_company?: boolean;
  client_name?: string;
  // Email settings
  auto_send_invoice_email?: boolean;
  email_signature_sr?: string | null;
  email_signature_en?: string | null;
}

export function useCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch my own companies - explicitly exclude sef_api_key for security
  const { data: myCompanies = [], isLoading: loadingMy } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, user_id, name, address, city, country, pib, maticni_broj, bank_account, logo_url, sef_enabled, has_sef_api_key, fiscal_enabled, is_active, created_at, updated_at, bookkeeper_email, bookkeeper_id, bookkeeper_status, bookkeeper_invited_at, auto_send_invoice_email, email_signature_sr, email_signature_en')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Company[];
    },
    enabled: !!user,
  });

  // Fetch client companies (as bookkeeper) - using NEW company-level bookkeeper system
  const { data: clientCompanies = [], isLoading: loadingClients } = useQuery({
    queryKey: ['client-companies', user?.id],
    queryFn: async () => {
      // Get companies where I am the accepted bookkeeper (new system)
      const { data: companiesWithMe, error: newError } = await supabase
        .from('companies')
        .select('id, user_id, name, address, city, country, pib, maticni_broj, bank_account, logo_url, sef_enabled, has_sef_api_key, fiscal_enabled, is_active, created_at, updated_at, bookkeeper_email, bookkeeper_id, bookkeeper_status, bookkeeper_invited_at, auto_send_invoice_email, email_signature_sr, email_signature_en')
        .eq('bookkeeper_id', user!.id)
        .eq('bookkeeper_status', 'accepted')
        .order('created_at', { ascending: false });

      if (newError) throw newError;

      // Also check old bookkeeper_clients table for backwards compatibility
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user!.id)
        .single();

      let oldCompanies: any[] = [];
      if (profile?.email) {
        const { data: clientRelations } = await supabase
          .from('bookkeeper_clients')
          .select('client_id')
          .eq('bookkeeper_email', profile.email)
          .eq('status', 'accepted');

        if (clientRelations?.length) {
          const clientIds = clientRelations.map(r => r.client_id);
          const { data: companies } = await supabase
            .from('companies')
            .select('id, user_id, name, address, city, country, pib, maticni_broj, bank_account, logo_url, sef_enabled, has_sef_api_key, fiscal_enabled, is_active, created_at, updated_at, bookkeeper_email, bookkeeper_id, bookkeeper_status, bookkeeper_invited_at, auto_send_invoice_email, email_signature_sr, email_signature_en')
            .in('user_id', clientIds)
            .order('created_at', { ascending: false });
          
          oldCompanies = companies || [];
        }
      }

      // Merge both lists (avoiding duplicates)
      const allCompanies = [...(companiesWithMe || [])];
      const existingIds = new Set(allCompanies.map(c => c.id));
      
      for (const company of oldCompanies) {
        if (!existingIds.has(company.id)) {
          allCompanies.push(company);
        }
      }

      // Get owner profiles for names
      const ownerIds = [...new Set(allCompanies.map(c => c.user_id))];
      const { data: ownerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);

      // Mark these as client companies and add client name
      return allCompanies.map(company => ({
        ...company,
        is_client_company: true,
        client_name: ownerProfiles?.find(p => p.id === company.user_id)?.full_name || 
                    ownerProfiles?.find(p => p.id === company.user_id)?.email || 
                    'Klijent',
      })) as Company[];
    },
    enabled: !!user,
  });

  // Combine all companies (memoized to avoid re-running effects on every render)
  const companies = useMemo(() => [...myCompanies, ...clientCompanies], [myCompanies, clientCompanies]);

  const createCompany = useMutation({
    // has_sef_api_key is a computed column, so we exclude it from create
    mutationFn: async (company: Omit<Company, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_client_company' | 'client_name' | 'logo_url' | 'has_sef_api_key'> & { logo_url?: string | null }) => {
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
    mutationFn: async ({ id, is_client_company, client_name, ...company }: Partial<Company> & { id: string }) => {
      // is_client_company i client_name su frontend-only polja, ne šaljemo ih u bazu
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
      queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      queryClient.invalidateQueries({ queryKey: ['selected-company'] });
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

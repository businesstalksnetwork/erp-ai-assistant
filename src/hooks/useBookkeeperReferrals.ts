import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { getProductionUrl } from '@/lib/domain';

interface Referral {
  id: string;
  bookkeeper_id: string;
  client_id: string;
  referred_at: string;
  created_at: string;
  client?: {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
    subscription_end: string | null;
    is_trial: boolean;
  };
}

interface Earning {
  id: string;
  bookkeeper_id: string;
  client_id: string;
  payment_month: string;
  client_payment_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'invoiced' | 'paid';
  invoice_id: string | null;
  created_at: string;
}

export function useBookkeeperReferrals() {
  const { user, isBookkeeper } = useAuth();
  const queryClient = useQueryClient();

  // Fetch referrals for the bookkeeper
  const { data: referrals, isLoading: isLoadingReferrals } = useQuery({
    queryKey: ['bookkeeper-referrals', user?.id],
    queryFn: async () => {
      if (!user?.id || !isBookkeeper) return [];
      
      const { data, error } = await supabase
        .from('bookkeeper_referrals')
        .select('*')
        .eq('bookkeeper_id', user.id)
        .order('referred_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch client profiles separately
      if (data && data.length > 0) {
        const clientIds = data.map(r => r.client_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name, company_name, subscription_end, is_trial')
          .in('id', clientIds);
        
        return data.map(referral => ({
          ...referral,
          client: profiles?.find(p => p.id === referral.client_id)
        })) as Referral[];
      }
      
      return data as Referral[];
    },
    enabled: !!user?.id && isBookkeeper,
  });

  // Fetch earnings for the bookkeeper
  const { data: earnings, isLoading: isLoadingEarnings } = useQuery({
    queryKey: ['bookkeeper-earnings', user?.id],
    queryFn: async () => {
      if (!user?.id || !isBookkeeper) return [];
      
      const { data, error } = await supabase
        .from('bookkeeper_earnings')
        .select('*')
        .eq('bookkeeper_id', user.id)
        .order('payment_month', { ascending: false });
      
      if (error) throw error;
      return data as Earning[];
    },
    enabled: !!user?.id && isBookkeeper,
  });

  // Calculate totals
  const totalReferrals = referrals?.length || 0;
  const activeClients = referrals?.filter(r => {
    if (!r.client?.subscription_end) return false;
    return new Date(r.client.subscription_end) > new Date();
  }).length || 0;
  
  const totalEarned = earnings?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;
  const pendingEarnings = earnings?.filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

  // Generate referral link
  const getReferralLink = () => {
    if (!user?.id) return '';
    return `${getProductionUrl()}/auth?ref=${user.id}`;
  };

  return {
    referrals: referrals ?? [],
    earnings: earnings ?? [],
    isLoadingReferrals,
    isLoadingEarnings,
    totalReferrals,
    activeClients,
    totalEarned,
    pendingEarnings,
    getReferralLink,
  };
}

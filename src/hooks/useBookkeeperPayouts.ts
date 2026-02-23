// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BookkeeperPayout {
  bookkeeper_id: string;
  bookkeeper_email: string;
  bookkeeper_name: string | null;
  bookkeeper_company_name: string | null;
  bookkeeper_pib: string | null;
  bookkeeper_bank_account: string | null;
  bookkeeper_address: string | null;
  pending_amount: number;
  pending_earnings: {
    id: string;
    client_id: string;
    client_email: string;
    client_name: string | null;
    payment_month: string;
    client_payment_amount: number;
    commission_amount: number;
    created_at: string;
  }[];
}

export interface PayoutHistory {
  id: string;
  bookkeeper_id: string;
  bookkeeper_email: string;
  bookkeeper_name: string | null;
  total_amount: number;
  paid_at: string;
  paid_by: string;
  earnings_count: number;
}

export function useBookkeeperPayouts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch pending payouts grouped by bookkeeper
  const { data: pendingPayouts = [], isLoading: isLoadingPending } = useQuery({
    queryKey: ['admin-bookkeeper-payouts'],
    queryFn: async () => {
      // Get all pending earnings with bookkeeper and client info
      const { data: earnings, error } = await supabase
        .from('bookkeeper_earnings')
        .select(`
          id,
          bookkeeper_id,
          client_id,
          payment_month,
          client_payment_amount,
          commission_amount,
          created_at
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!earnings || earnings.length === 0) return [];

      // Get admin user IDs to exclude from payouts
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      
      // Filter out earnings from admin bookkeepers
      const filteredEarnings = earnings.filter(e => !adminIds.has(e.bookkeeper_id));
      
      if (filteredEarnings.length === 0) return [];

      // Get unique bookkeeper IDs (from filtered earnings)
      const bookkeeperIds = [...new Set(filteredEarnings.map(e => e.bookkeeper_id))];
      const clientIds = [...new Set(filteredEarnings.map(e => e.client_id))];

      // Fetch bookkeeper profiles
      const { data: bookkeeperProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, bookkeeper_company_name, bookkeeper_pib, bookkeeper_bank_account, bookkeeper_address')
        .in('id', bookkeeperIds);

      // Fetch client profiles
      const { data: clientProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', clientIds);

      // Create maps for quick lookup
      const bookkeeperMap = new Map((bookkeeperProfiles || []).map(p => [p.id, p]));
      const clientMap = new Map((clientProfiles || []).map(p => [p.id, p]));

      // Group earnings by bookkeeper
      const payoutsMap = new Map<string, BookkeeperPayout>();

      for (const earning of filteredEarnings) {
        const bookkeeper = bookkeeperMap.get(earning.bookkeeper_id);
        const client = clientMap.get(earning.client_id);

        if (!payoutsMap.has(earning.bookkeeper_id)) {
          payoutsMap.set(earning.bookkeeper_id, {
            bookkeeper_id: earning.bookkeeper_id,
            bookkeeper_email: bookkeeper?.email || 'Unknown',
            bookkeeper_name: bookkeeper?.full_name || null,
            bookkeeper_company_name: (bookkeeper as any)?.bookkeeper_company_name || null,
            bookkeeper_pib: (bookkeeper as any)?.bookkeeper_pib || null,
            bookkeeper_bank_account: (bookkeeper as any)?.bookkeeper_bank_account || null,
            bookkeeper_address: (bookkeeper as any)?.bookkeeper_address || null,
            pending_amount: 0,
            pending_earnings: [],
          });
        }

        const payout = payoutsMap.get(earning.bookkeeper_id)!;
        payout.pending_amount += earning.commission_amount;
        payout.pending_earnings.push({
          id: earning.id,
          client_id: earning.client_id,
          client_email: client?.email || 'Unknown',
          client_name: client?.full_name || null,
          payment_month: earning.payment_month,
          client_payment_amount: earning.client_payment_amount,
          commission_amount: earning.commission_amount,
          created_at: earning.created_at,
        });
      }

      return Array.from(payoutsMap.values());
    },
  });

  // Fetch payout history
  const { data: payoutHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['admin-payout-history'],
    queryFn: async () => {
      const { data: paidEarnings, error } = await supabase
        .from('bookkeeper_earnings')
        .select('bookkeeper_id, commission_amount, paid_at, paid_by')
        .eq('status', 'paid')
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      if (!paidEarnings || paidEarnings.length === 0) return [];

      // Group by bookkeeper and paid_at date (same day = same payout)
      const bookkeeperIds = [...new Set(paidEarnings.map(e => e.bookkeeper_id))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', bookkeeperIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Group by bookkeeper and date
      const historyMap = new Map<string, PayoutHistory>();

      for (const earning of paidEarnings) {
        const dateKey = earning.paid_at?.split('T')[0] || '';
        const key = `${earning.bookkeeper_id}_${dateKey}`;
        const profile = profileMap.get(earning.bookkeeper_id);

        if (!historyMap.has(key)) {
          historyMap.set(key, {
            id: key,
            bookkeeper_id: earning.bookkeeper_id,
            bookkeeper_email: profile?.email || 'Unknown',
            bookkeeper_name: profile?.full_name || null,
            total_amount: 0,
            paid_at: earning.paid_at || '',
            paid_by: earning.paid_by || '',
            earnings_count: 0,
          });
        }

        const history = historyMap.get(key)!;
        history.total_amount += earning.commission_amount;
        history.earnings_count += 1;
      }

      return Array.from(historyMap.values());
    },
  });

  // Mark earnings as paid
  const markAsPaid = useMutation({
    mutationFn: async ({ bookkeeperIds, adminId }: { bookkeeperIds: string[]; adminId: string }) => {
      const { error } = await supabase
        .from('bookkeeper_earnings')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: adminId,
        })
        .in('bookkeeper_id', bookkeeperIds)
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookkeeper-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payout-history'] });
      toast({
        title: 'Uspešno označeno',
        description: 'Isplate su označene kao plaćene.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Greška',
        description: 'Nije moguće označiti isplatu.',
        variant: 'destructive',
      });
    },
  });

  // Calculate summary stats
  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.pending_amount, 0);
  const totalPaidThisMonth = payoutHistory
    .filter(h => {
      const paidDate = new Date(h.paid_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, h) => sum + h.total_amount, 0);

  return {
    pendingPayouts,
    payoutHistory,
    isLoadingPending,
    isLoadingHistory,
    markAsPaid,
    totalPending,
    totalPaidThisMonth,
    bookkeeperCount: pendingPayouts.length,
  };
}

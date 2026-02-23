import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserStats {
  total: number;
  activePaid: number;
  activeTrial: number;
  expiredTrial: number;
  expiredPaid: number;
  blocked: number;
  promo: number;
}

export interface MonthlyData {
  month: string;
  value: number;
  label?: string;
}

export interface BookkeeperStats {
  id: string;
  email: string;
  fullName: string | null;
  referrals: number;
  activeClients: number;
  totalEarned: number;
  pendingAmount: number;
}

export interface PartnerStats {
  id: string;
  name: string;
  code: string;
  discountPercent: number | null;
  totalUsers: number;
  paidUsers: number;
  trialUsers: number;
  conversionRate: number;
}

export interface TopUser {
  companyName: string;
  userEmail: string;
  invoiceCount: number;
  totalAmount: number;
}

export interface FeatureUsage {
  feature: string;
  companies: number;
  percentage: number;
}

export interface RevenueStats {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  totalPayments: number;
  estimatedMRR: number;
  monthlyData: MonthlyData[];
  // Real commission calculations
  pendingCommissions: number;
  paidCommissions: number;
  referredActiveCount: number;
  estimatedCommissions: number;
}

export interface PaymentRecord {
  id: string;
  paymentDate: string;
  userEmail: string;
  userName: string | null;
  months: number;
  amount: number;
  discountPercent: number | null;
  adminEmail: string | null;
}

export function useAdminAnalytics() {
  // User statistics query
  const userStatsQuery = useQuery({
    queryKey: ['admin-analytics-users'],
    queryFn: async (): Promise<UserStats> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, is_trial, subscription_end, block_reason, status, partner_id');

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      
      return {
        total: data?.length || 0,
        activePaid: data?.filter(u => 
          !u.is_trial && 
          u.subscription_end && 
          u.subscription_end >= today &&
          !u.block_reason
        ).length || 0,
        activeTrial: data?.filter(u => 
          u.is_trial && 
          u.subscription_end && 
          u.subscription_end >= today &&
          !u.block_reason
        ).length || 0,
        expiredTrial: data?.filter(u => 
          u.is_trial && 
          (!u.subscription_end || u.subscription_end < today) &&
          !u.block_reason
        ).length || 0,
        expiredPaid: data?.filter(u => 
          !u.is_trial && 
          (!u.subscription_end || u.subscription_end < today) &&
          !u.block_reason
        ).length || 0,
        blocked: data?.filter(u => u.block_reason).length || 0,
        promo: data?.filter(u => u.partner_id !== null).length || 0,
      };
    },
  });

  // User growth by month
  const userGrowthQuery = useQuery({
    queryKey: ['admin-analytics-user-growth'],
    queryFn: async (): Promise<MonthlyData[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('created_at, is_trial');

      if (error) throw error;

      const monthlyData: Record<string, { newUsers: number; converted: number }> = {};
      
      data?.forEach(user => {
        const month = user.created_at.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { newUsers: 0, converted: 0 };
        }
        monthlyData[month].newUsers++;
        if (!user.is_trial) {
          monthlyData[month].converted++;
        }
      });

      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          value: data.newUsers,
          label: `${data.converted} konvertovanih`,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);
    },
  });

  // Feature usage statistics
  const featureUsageQuery = useQuery({
    queryKey: ['admin-analytics-feature-usage'],
    queryFn: async (): Promise<FeatureUsage[]> => {
      // Get total companies count
      const { count: totalCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });

      const total = totalCompanies || 1;

      // Get companies with invoices
      const { data: invoiceCompanies } = await supabase
        .from('invoices')
        .select('company_id');
      const uniqueInvoiceCompanies = new Set(invoiceCompanies?.map(i => i.company_id)).size;

      // Get companies with KPO
      const { data: kpoCompanies } = await supabase
        .from('kpo_entries')
        .select('company_id');
      const uniqueKpoCompanies = new Set(kpoCompanies?.map(k => k.company_id)).size;

      // Get companies with reminders
      const { data: reminderCompanies } = await supabase
        .from('payment_reminders')
        .select('company_id');
      const uniqueReminderCompanies = new Set(reminderCompanies?.map(r => r.company_id)).size;

      // Get companies with SEF
      const { data: sefCompanies } = await supabase
        .from('sef_invoices')
        .select('company_id');
      const uniqueSefCompanies = new Set(sefCompanies?.map(s => s.company_id)).size;

      // Get companies with fiscal
      const { data: fiscalCompanies } = await supabase
        .from('fiscal_entries')
        .select('company_id');
      const uniqueFiscalCompanies = new Set(fiscalCompanies?.map(f => f.company_id)).size;

      // Get companies with clients
      const { data: clientCompanies } = await supabase
        .from('clients')
        .select('company_id');
      const uniqueClientCompanies = new Set(clientCompanies?.map(c => c.company_id)).size;

      return [
        { feature: 'KPO Knjiga', companies: uniqueKpoCompanies, percentage: Math.round((uniqueKpoCompanies / total) * 100) },
        { feature: 'Podsetnici', companies: uniqueReminderCompanies, percentage: Math.round((uniqueReminderCompanies / total) * 100) },
        { feature: 'Fakture', companies: uniqueInvoiceCompanies, percentage: Math.round((uniqueInvoiceCompanies / total) * 100) },
        { feature: 'Klijenti', companies: uniqueClientCompanies, percentage: Math.round((uniqueClientCompanies / total) * 100) },
        { feature: 'SEF', companies: uniqueSefCompanies, percentage: Math.round((uniqueSefCompanies / total) * 100) },
        { feature: 'Fiskalna kasa', companies: uniqueFiscalCompanies, percentage: Math.round((uniqueFiscalCompanies / total) * 100) },
      ].sort((a, b) => b.percentage - a.percentage);
    },
  });

  // Top users by activity
  const topUsersQuery = useQuery({
    queryKey: ['admin-analytics-top-users'],
    queryFn: async (): Promise<TopUser[]> => {
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id, name, user_id');

      if (companyError) throw companyError;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email');

      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices')
        .select('company_id, total_amount');

      if (invoiceError) throw invoiceError;

      const companyStats: Record<string, { count: number; amount: number }> = {};
      
      invoices?.forEach(inv => {
        if (!companyStats[inv.company_id]) {
          companyStats[inv.company_id] = { count: 0, amount: 0 };
        }
        companyStats[inv.company_id].count++;
        companyStats[inv.company_id].amount += inv.total_amount || 0;
      });

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]));

      return companies
        ?.map(company => ({
          companyName: company.name,
          userEmail: profileMap.get(company.user_id) || 'N/A',
          invoiceCount: companyStats[company.id]?.count || 0,
          totalAmount: companyStats[company.id]?.amount || 0,
        }))
        .filter(c => c.invoiceCount > 0)
        .sort((a, b) => b.invoiceCount - a.invoiceCount)
        .slice(0, 10) || [];
    },
  });

  // Bookkeeper statistics
  const bookkeeperStatsQuery = useQuery({
    queryKey: ['admin-analytics-bookkeepers'],
    queryFn: async (): Promise<BookkeeperStats[]> => {
      const { data: bookkeepers, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('account_type', 'bookkeeper');

      if (error) throw error;

      // Get admin user IDs to filter them out
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminIds = new Set((adminRoles || []).map(r => r.user_id));

      const { data: referrals } = await supabase
        .from('bookkeeper_referrals')
        .select('bookkeeper_id, client_id');

      const { data: clients } = await supabase
        .from('bookkeeper_clients')
        .select('bookkeeper_id, client_id, status');

      const { data: earnings } = await supabase
        .from('bookkeeper_earnings')
        .select('bookkeeper_id, commission_amount, status');

      // Also check companies table for bookkeeper connections
      const { data: companyBookkeepers } = await supabase
        .from('companies')
        .select('bookkeeper_id')
        .not('bookkeeper_id', 'is', null);

      const companyBookkeeperCounts: Record<string, number> = {};
      companyBookkeepers?.forEach(c => {
        if (c.bookkeeper_id) {
          companyBookkeeperCounts[c.bookkeeper_id] = (companyBookkeeperCounts[c.bookkeeper_id] || 0) + 1;
        }
      });

      // Filter out admins from bookkeeper list
      return bookkeepers
        ?.filter(bk => !adminIds.has(bk.id))
        .map(bk => {
          const bkReferrals = referrals?.filter(r => r.bookkeeper_id === bk.id) || [];
          const bkClients = clients?.filter(c => c.bookkeeper_id === bk.id && c.status === 'accepted') || [];
          const bkEarnings = earnings?.filter(e => e.bookkeeper_id === bk.id) || [];
          
          const activeClients = (bkClients.length || 0) + (companyBookkeeperCounts[bk.id] || 0);
          
          return {
            id: bk.id,
            email: bk.email,
            fullName: bk.full_name,
            referrals: bkReferrals.length,
            activeClients,
            totalEarned: bkEarnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.commission_amount || 0), 0),
            pendingAmount: bkEarnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.commission_amount || 0), 0),
          };
        }).sort((a, b) => b.activeClients - a.activeClients) || [];
    },
  });

  // Partner statistics
  const partnerStatsQuery = useQuery({
    queryKey: ['admin-analytics-partners'],
    queryFn: async (): Promise<PartnerStats[]> => {
      const { data: partners, error } = await supabase
        .from('partners')
        .select('id, name, code, discount_percent, is_active');

      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('partner_id, is_trial, subscription_end');

      const today = new Date().toISOString().split('T')[0];

      return partners?.filter(p => p.is_active).map(partner => {
        const partnerProfiles = profiles?.filter(p => p.partner_id === partner.id) || [];
        const paidUsers = partnerProfiles.filter(p => 
          !p.is_trial && p.subscription_end && p.subscription_end >= today
        ).length;
        const trialUsers = partnerProfiles.filter(p => p.is_trial).length;
        const totalUsers = partnerProfiles.length;

        return {
          id: partner.id,
          name: partner.name,
          code: partner.code,
          discountPercent: partner.discount_percent,
          totalUsers,
          paidUsers,
          trialUsers,
          conversionRate: totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0,
        };
      }).sort((a, b) => b.totalUsers - a.totalUsers) || [];
    },
  });

  // Revenue statistics
  const revenueStatsQuery = useQuery({
    queryKey: ['admin-analytics-revenue'],
    queryFn: async (): Promise<RevenueStats> => {
      const { data: payments, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];

      const thisMonthPayments = payments?.filter(p => p.payment_date >= thisMonthStart) || [];
      const lastMonthPayments = payments?.filter(p => 
        p.payment_date >= lastMonthStart && p.payment_date <= lastMonthEnd
      ) || [];

      // Calculate monthly data
      const monthlyMap: Record<string, number> = {};
      payments?.forEach(p => {
        const month = p.payment_date.substring(0, 7);
        monthlyMap[month] = (monthlyMap[month] || 0) + p.amount;
      });

      const monthlyData = Object.entries(monthlyMap)
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Get active paid users for MRR calculation
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_trial', false)
        .gte('subscription_end', todayStr);

      const activePaidCount = activeUsers?.length || 0;
      const estimatedMRR = activePaidCount * 990; // 990 RSD average monthly

      // Get REAL commission data from bookkeeper_earnings
      const { data: pendingEarningsData } = await supabase
        .from('bookkeeper_earnings')
        .select('commission_amount')
        .eq('status', 'pending');

      const { data: paidEarningsData } = await supabase
        .from('bookkeeper_earnings')
        .select('commission_amount')
        .eq('status', 'paid');

      const pendingCommissions = pendingEarningsData?.reduce((sum, e) => sum + (e.commission_amount || 0), 0) || 0;
      const paidCommissions = paidEarningsData?.reduce((sum, e) => sum + (e.commission_amount || 0), 0) || 0;

      // Get count of active referred users (for future commission projections)
      const { data: referredActiveUsers } = await supabase
        .from('profiles')
        .select('id')
        .not('invited_by_user_id', 'is', null)
        .eq('is_trial', false)
        .gte('subscription_end', todayStr);

      const referredActiveCount = referredActiveUsers?.length || 0;
      // Estimated monthly commissions = referred active users * 990 * 20%
      const estimatedCommissions = Math.round(referredActiveCount * 990 * 0.2);

      return {
        totalRevenue: payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        thisMonthRevenue: thisMonthPayments.reduce((sum, p) => sum + p.amount, 0),
        lastMonthRevenue: lastMonthPayments.reduce((sum, p) => sum + p.amount, 0),
        totalPayments: payments?.length || 0,
        estimatedMRR,
        monthlyData,
        pendingCommissions,
        paidCommissions,
        referredActiveCount,
        estimatedCommissions,
      };
    },
  });

  // Recent payments list
  const recentPaymentsQuery = useQuery({
    queryKey: ['admin-analytics-recent-payments'],
    queryFn: async (): Promise<PaymentRecord[]> => {
      const { data: payments, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = [...new Set(payments?.map(p => p.user_id) || [])];
      const adminIds = [...new Set(payments?.filter(p => p.admin_id).map(p => p.admin_id!) || [])];

      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', [...userIds, ...adminIds]);

      const userMap = new Map(users?.map(u => [u.id, { email: u.email, name: u.full_name }]));

      return payments?.map(p => ({
        id: p.id,
        paymentDate: p.payment_date,
        userEmail: userMap.get(p.user_id)?.email || 'N/A',
        userName: userMap.get(p.user_id)?.name || null,
        months: p.months,
        amount: p.amount,
        discountPercent: p.discount_percent,
        adminEmail: p.admin_id ? userMap.get(p.admin_id)?.email || null : null,
      })) || [];
    },
  });

  // Invoice activity by month
  const invoiceActivityQuery = useQuery({
    queryKey: ['admin-analytics-invoice-activity'],
    queryFn: async (): Promise<MonthlyData[]> => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('issue_date, total_amount')
        .eq('is_proforma', false);

      if (error) throw error;

      const monthlyMap: Record<string, number> = {};
      invoices?.forEach(inv => {
        const month = inv.issue_date.substring(0, 7);
        monthlyMap[month] = (monthlyMap[month] || 0) + 1;
      });

      return Object.entries(monthlyMap)
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);
    },
  });

  // All profiles for user table
  const allUsersQuery = useQuery({
    queryKey: ['admin-analytics-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = 
    userStatsQuery.isLoading || 
    userGrowthQuery.isLoading || 
    featureUsageQuery.isLoading ||
    topUsersQuery.isLoading ||
    bookkeeperStatsQuery.isLoading ||
    partnerStatsQuery.isLoading ||
    revenueStatsQuery.isLoading;

  return {
    userStats: userStatsQuery.data,
    userGrowth: userGrowthQuery.data,
    featureUsage: featureUsageQuery.data,
    topUsers: topUsersQuery.data,
    bookkeeperStats: bookkeeperStatsQuery.data,
    partnerStats: partnerStatsQuery.data,
    revenueStats: revenueStatsQuery.data,
    recentPayments: recentPaymentsQuery.data,
    invoiceActivity: invoiceActivityQuery.data,
    allUsers: allUsersQuery.data,
    isLoading,
    refetch: () => {
      userStatsQuery.refetch();
      userGrowthQuery.refetch();
      featureUsageQuery.refetch();
      topUsersQuery.refetch();
      bookkeeperStatsQuery.refetch();
      partnerStatsQuery.refetch();
      revenueStatsQuery.refetch();
      recentPaymentsQuery.refetch();
      invoiceActivityQuery.refetch();
      allUsersQuery.refetch();
    },
  };
}

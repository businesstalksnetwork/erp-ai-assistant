import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  pib: string | null;
  company_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  subscription_end: string | null;
  block_reason: string | null;
  is_trial: boolean;
  max_companies: number;
  account_type: 'pausal' | 'bookkeeper';
  agency_name: string | null;
  agency_pib: string | null;
  invited_by_user_id: string | null;
  email_reminder_7_days_before: boolean;
  email_reminder_day_before: boolean;
  email_reminder_on_due_date: boolean;
  email_limit_6m_warning: boolean;
  email_limit_8m_warning: boolean;
  email_subscription_warnings: boolean;
  partner_id: string | null;
  partner_discount_percent: number;
  // Bookkeeper payout info
  bookkeeper_company_name: string | null;
  bookkeeper_pib: string | null;
  bookkeeper_bank_account: string | null;
  bookkeeper_address: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isApproved: boolean;
  isBlocked: boolean;
  isBookkeeper: boolean;
  subscriptionDaysLeft: number;
  isSubscriptionExpiring: boolean;
  isSubscriptionExpired: boolean;
  loading: boolean;
  signUp: (
    email: string, 
    password: string, 
    fullName: string, 
    pib: string, 
    companyName: string,
    accountType?: 'pausal' | 'bookkeeper',
    agencyName?: string,
    agencyPib?: string,
    invitedByUserId?: string,
    partnerCode?: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileData) {
      setProfile({
        ...profileData,
        max_companies: (profileData as any).max_companies ?? 1,
        account_type: (profileData as any).account_type ?? 'pausal',
        agency_name: (profileData as any).agency_name ?? null,
        agency_pib: (profileData as any).agency_pib ?? null,
        invited_by_user_id: (profileData as any).invited_by_user_id ?? null,
        email_reminder_7_days_before: (profileData as any).email_reminder_7_days_before ?? true,
        email_reminder_day_before: (profileData as any).email_reminder_day_before ?? true,
        email_reminder_on_due_date: (profileData as any).email_reminder_on_due_date ?? false,
        email_limit_6m_warning: (profileData as any).email_limit_6m_warning ?? true,
        email_limit_8m_warning: (profileData as any).email_limit_8m_warning ?? true,
        email_subscription_warnings: (profileData as any).email_subscription_warnings ?? true,
        bookkeeper_company_name: (profileData as any).bookkeeper_company_name ?? null,
        bookkeeper_pib: (profileData as any).bookkeeper_pib ?? null,
        bookkeeper_bank_account: (profileData as any).bookkeeper_bank_account ?? null,
        bookkeeper_address: (profileData as any).bookkeeper_address ?? null,
      } as Profile);
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roleData);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    pib: string, 
    companyName: string,
    accountType: 'pausal' | 'bookkeeper' = 'pausal',
    agencyName?: string,
    agencyPib?: string,
    invitedByUserId?: string,
    partnerCode?: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          pib: pib,
          company_name: companyName,
          account_type: accountType,
          agency_name: agencyName,
          agency_pib: agencyPib,
          invited_by_user_id: invitedByUserId,
          partner_code: partnerCode,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem('pausalbox_selected_company_id');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const isApproved = profile?.status === 'approved' || isAdmin;
  const isBlocked = profile?.status === 'rejected';
  const isBookkeeper = profile?.account_type === 'bookkeeper';

  // Calculate subscription days left - bookkeepers have unlimited access
  const subscriptionDaysLeft = isBookkeeper 
    ? 999 
    : profile?.subscription_end
      ? Math.ceil((new Date(profile.subscription_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const isSubscriptionExpiring = !isBookkeeper && subscriptionDaysLeft <= 14 && subscriptionDaysLeft > 0;
  const isSubscriptionExpired = !isBookkeeper && subscriptionDaysLeft <= 0 && profile?.subscription_end !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isApproved,
        isBlocked,
        isBookkeeper,
        subscriptionDaysLeft,
        isSubscriptionExpiring,
        isSubscriptionExpired,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

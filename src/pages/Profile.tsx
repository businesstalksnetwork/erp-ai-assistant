import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { useBookkeeperReferrals } from '@/hooks/useBookkeeperReferrals';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CreditCard, 
  Shield, 
  Settings, 
  Users, 
  Copy, 
  Check,
  Calendar,
  TrendingUp,
  Clock,
  Moon,
  Sun,
  Wallet,
  Mail,
  Bell,
  AlertTriangle,
  Sparkles,
  Percent
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

// IPS QR Code generation - NBS standard compliant
function formatAccountForIPS(account: string): string {
  // Split by dash for standard Serbian account format (XXX-XXXXXXXXXXXXX-XX)
  const parts = account.replace(/\s/g, '').split('-');

  if (parts.length === 3) {
    const bank = parts[0].replace(/\D/g, '').padStart(3, '0').slice(0, 3);
    const middle = parts[1].replace(/\D/g, '').padStart(13, '0').slice(0, 13);
    const control = parts[2].replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    return `${bank}${middle}${control}`;
  }

  // Fallback: just pad to 18 digits
  return account.replace(/\D/g, '').padStart(18, '0').slice(0, 18);
}

function generateSubscriptionIPSQRCode(
  recipientName: string,
  recipientAccount: string,
  amount: number,
  purpose: string,
  payerName: string
): string {
  const formattedAccount = formatAccountForIPS(recipientAccount);
  
  // CRITICAL: Use comma as decimal separator per NBS IPS standard
  const amountStr = amount.toFixed(2).replace('.', ',');
  
  const sanitize = (value: string) => 
    value.replace(/\|/g, ' ').replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 70);
  
  const fields = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${formattedAccount}`,
    `N:${sanitize(recipientName)}`,
    `I:RSD${amountStr}`,
  ];
  
  if (payerName) {
    fields.push(`P:${sanitize(payerName)}`);
  }
  
  fields.push('SF:221');
  fields.push(`S:${sanitize(purpose).substring(0, 35)}`);
  
  return fields.join('|');
}

// Subscription plans
const subscriptionPlans = [
  { 
    key: 'monthly' as const, 
    name: 'Mesečni', 
    price: 890, 
    months: 1,
    description: 'Za nove korisnike'
  },
  { 
    key: 'semi-annual' as const, 
    name: 'Polugodišnji', 
    price: 4450, 
    months: 6,
    description: 'Besplatno 1 mesec',
    popular: true
  },
  { 
    key: 'annual' as const, 
    name: 'Godišnji', 
    price: 8900, 
    months: 12,
    description: 'Besplatno 2 meseca'
  }
];

// Payment recipient info
const paymentRecipient = {
  name: 'Nikola Glintic Pr NIKOLA FINCON',
  account: '265-2010310010198-19',
  address: 'NOVOSADSKOG SAJMA 6, 21000 Novi Sad'
};

export default function Profile() {
  const { profile, isBookkeeper, subscriptionDaysLeft, isSubscriptionExpiring, isSubscriptionExpired, user, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'semi-annual' | 'annual'>('semi-annual');
  
  const { 
    referrals, 
    totalReferrals, 
    activeClients, 
    totalEarned, 
    pendingEarnings,
    getReferralLink,
    isLoadingReferrals
  } = useBookkeeperReferrals();

  // Partner discount from profile
  const userDiscount = profile?.partner_discount_percent || 0;

  // Calculate discounted price
  const getDiscountedPrice = (price: number) => {
    if (userDiscount > 0) {
      return Math.round(price * (1 - userDiscount / 100));
    }
    return price;
  };

  const handleCopyLink = async () => {
    const link = getReferralLink();
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: 'Link kopiran',
      description: 'Referral link je kopiran u clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const updateEmailPreference = async (field: string, value: boolean) => {
    if (!user) return;
    setUpdatingEmail(field);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id);
      
      if (error) throw error;
      
      await refreshProfile();
      toast({
        title: 'Sačuvano',
        description: 'Podešavanje email notifikacija je ažurirano.',
      });
    } catch (error) {
      toast({
        title: 'Greška',
        description: 'Nije moguće sačuvati podešavanje.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingEmail(null);
    }
  };

  const getSubscriptionStatus = () => {
    if (isBookkeeper) {
      return { label: 'Besplatno', variant: 'default' as const, color: 'text-green-600' };
    }
    if (isSubscriptionExpired) {
      return { label: 'Istekla', variant: 'destructive' as const, color: 'text-destructive' };
    }
    if (isSubscriptionExpiring) {
      return { label: 'Ističe uskoro', variant: 'secondary' as const, color: 'text-orange-500' };
    }
    if (profile?.is_trial) {
      return { label: 'Probni period', variant: 'secondary' as const, color: 'text-blue-500' };
    }
    return { label: 'Aktivna', variant: 'default' as const, color: 'text-green-600' };
  };

  const status = getSubscriptionStatus();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moj Profil</h1>
        <p className="text-muted-foreground">
          Upravljajte vašim nalogom i podešavanjima
        </p>
      </div>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className={`grid w-full ${isBookkeeper ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pretplata</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Bezbednost</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Podešavanja</span>
          </TabsTrigger>
          {isBookkeeper && (
            <TabsTrigger value="earnings" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Zarada</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Status pretplate
                <Badge variant={status.variant}>{status.label}</Badge>
              </CardTitle>
              <CardDescription>
                {isBookkeeper 
                  ? 'Korišćenje aplikacije je besplatno za knjigovođe'
                  : 'Informacije o vašoj trenutnoj pretplati'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBookkeeper ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Besplatno zauvek</p>
                      <p className="text-sm text-muted-foreground">
                        Kao knjigovođa imate neograničen pristup svim funkcijama bez naknade.
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Referral program</h4>
                    <p className="text-sm text-muted-foreground">
                      Pozovite klijente i zaradite 20% od njihovih pretplata. Vaša zarada se automatski 
                      obračunava na kraju svakog meseca.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Važi do</p>
                        <p className="font-medium">
                          {profile?.subscription_end 
                            ? format(new Date(profile.subscription_end), 'dd. MMMM yyyy.', { locale: sr })
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Preostalo dana</p>
                        <p className={`font-medium ${status.color}`}>
                          {subscriptionDaysLeft > 0 ? subscriptionDaysLeft : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {(isSubscriptionExpiring || isSubscriptionExpired) && (
                    <div className={`p-4 rounded-lg ${isSubscriptionExpired ? 'bg-destructive/10' : 'bg-orange-50 dark:bg-orange-950'}`}>
                      <p className={`text-sm ${isSubscriptionExpired ? 'text-destructive' : 'text-orange-600'}`}>
                        {isSubscriptionExpired 
                          ? 'Vaša pretplata je istekla. Produžite pretplatu da biste nastavili sa korišćenjem.'
                          : 'Vaša pretplata uskoro ističe. Produžite pretplatu da biste izbegli prekid usluge.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Payment Section - Only for non-bookkeepers */}
          {!isBookkeeper && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Produženje pretplate
                </CardTitle>
                <CardDescription>
                  Izaberite paket i skenirajte QR kod za plaćanje
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Partner Discount Banner */}
                {userDiscount > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <Percent className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300">Partnerski popust aktivan</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Imate trajni popust od {userDiscount}% na sve pretplate
                      </p>
                    </div>
                  </div>
                )}

                {/* Plan Selection */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {subscriptionPlans.map((plan) => {
                    const discountedPrice = getDiscountedPrice(plan.price);
                    const hasDiscount = userDiscount > 0;

                    return (
                      <div
                        key={plan.key}
                        onClick={() => setSelectedPlan(plan.key)}
                        className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50 ${
                          selectedPlan === plan.key
                            ? 'border-primary bg-primary/5'
                            : 'border-muted'
                        }`}
                      >
                        {plan.popular && (
                          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                            Najpopularnije
                          </Badge>
                        )}
                        {hasDiscount && (
                          <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            -{userDiscount}%
                          </Badge>
                        )}
                        <div className="text-center space-y-1">
                          <p className="font-semibold">{plan.name}</p>
                          <div className="text-2xl font-bold">
                            {hasDiscount && (
                              <span className="text-sm line-through text-muted-foreground mr-2">
                                {plan.price.toLocaleString('sr-RS')}
                              </span>
                            )}
                            {discountedPrice.toLocaleString('sr-RS')} <span className="text-sm font-normal text-muted-foreground">RSD</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* QR Code and Payment Details */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-lg shrink-0">
                    <QRCodeSVG
                      value={generateSubscriptionIPSQRCode(
                        paymentRecipient.name,
                        paymentRecipient.account,
                        getDiscountedPrice(subscriptionPlans.find(p => p.key === selectedPlan)?.price || 0),
                        `Pretplata PausalBox ${subscriptionPlans.find(p => p.key === selectedPlan)?.months}m`,
                        profile?.full_name || ''
                      )}
                      size={160}
                      level="L"
                    />
                  </div>

                  {/* Payment Details */}
                  <div className="flex-1 space-y-3 text-sm w-full">
                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2">
                      <span className="text-muted-foreground">Primalac:</span>
                      <span className="font-medium">{paymentRecipient.name}</span>
                      
                      <span className="text-muted-foreground">Račun:</span>
                      <span className="font-mono">{paymentRecipient.account}</span>
                      
                      <span className="text-muted-foreground">Iznos:</span>
                      <span className="font-bold text-lg text-primary">
                        {getDiscountedPrice(subscriptionPlans.find(p => p.key === selectedPlan)?.price || 0).toLocaleString('sr-RS')},00 RSD
                        {userDiscount > 0 && (
                          <span className="text-xs font-normal text-green-600 ml-2">
                            (popust {userDiscount}%)
                          </span>
                        )}
                      </span>
                      
                      <span className="text-muted-foreground">Svrha:</span>
                      <span>Pretplata PausalBox {subscriptionPlans.find(p => p.key === selectedPlan)?.months} {
                        subscriptionPlans.find(p => p.key === selectedPlan)?.months === 1 ? 'mesec' : 'meseci'
                      }</span>
                    </div>
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p>
                    ℹ️ Pretplata će biti aktivirana u roku od <strong>24h</strong> od prijema uplate. 
                    Za pitanja kontaktirajte: <a href="mailto:smartfinnovisad@gmail.com" className="text-primary hover:underline">smartfinnovisad@gmail.com</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Podaci o nalogu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Ime i prezime</Label>
                  <p className="font-medium">{profile?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                {isBookkeeper ? (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Naziv agencije</Label>
                      <p className="font-medium">{(profile as any)?.agency_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PIB agencije</Label>
                      <p className="font-medium">{(profile as any)?.agency_pib || 'N/A'}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Naziv firme</Label>
                      <p className="font-medium">{profile?.company_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PIB</Label>
                      <p className="font-medium">{profile?.pib || 'N/A'}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lozinka</CardTitle>
              <CardDescription>
                Promenite vašu lozinku za pristup nalogu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordDialog />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email adresa</CardTitle>
              <CardDescription>
                Vaša email adresa za prijavu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{profile?.email}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Za promenu email adrese kontaktirajte podršku.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tema</CardTitle>
              <CardDescription>
                Izaberite svetlu ili tamnu temu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                  <div>
                    <p className="font-medium">{theme === 'dark' ? 'Tamna tema' : 'Svetla tema'}</p>
                    <p className="text-sm text-muted-foreground">
                      {theme === 'dark' ? 'Koristi se tamna pozadina' : 'Koristi se svetla pozadina'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={() => toggleTheme()}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email notifikacije
              </CardTitle>
              <CardDescription>
                Izaberite koje notifikacije želite da primate na email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reminders Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Podsetnici</h4>
                </div>
                
                <div className="space-y-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">7 dana pre roka</Label>
                      <p className="text-sm text-muted-foreground">
                        Primi email podsetnik 7 dana pre isteka roka obaveze
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_reminder_7_days_before ?? true}
                      onCheckedChange={(checked) => updateEmailPreference('email_reminder_7_days_before', checked)}
                      disabled={updatingEmail === 'email_reminder_7_days_before'}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Dan pre dospeća</Label>
                      <p className="text-sm text-muted-foreground">
                        Primi email dan pre nego što podsetnik dospeva
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_reminder_day_before ?? true}
                      onCheckedChange={(checked) => updateEmailPreference('email_reminder_day_before', checked)}
                      disabled={updatingEmail === 'email_reminder_day_before'}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Na dan dospeća</Label>
                      <p className="text-sm text-muted-foreground">
                        Primi email na dan kada podsetnik dospeva
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_reminder_on_due_date ?? false}
                      onCheckedChange={(checked) => updateEmailPreference('email_reminder_on_due_date', checked)}
                      disabled={updatingEmail === 'email_reminder_on_due_date'}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Subscription warnings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Pretplata i trial</h4>
                </div>
                
                <div className="space-y-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Upozorenja o isteku</Label>
                      <p className="text-sm text-muted-foreground">
                        Primi email 7, 3 i 1 dan pre isteka trial perioda ili pretplate
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_subscription_warnings ?? true}
                      onCheckedChange={(checked) => updateEmailPreference('email_subscription_warnings', checked)}
                      disabled={updatingEmail === 'email_subscription_warnings'}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Limits Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Upozorenja za limite</h4>
                </div>
                
                <div className="space-y-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Limit 6M</Label>
                      <p className="text-sm text-muted-foreground">
                        Obavesti me kada dostignem 80% i 90% limita od 6 miliona
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_limit_6m_warning ?? true}
                      onCheckedChange={(checked) => updateEmailPreference('email_limit_6m_warning', checked)}
                      disabled={updatingEmail === 'email_limit_6m_warning'}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Limit 8M</Label>
                      <p className="text-sm text-muted-foreground">
                        Obavesti me kada dostignem 80% i 90% limita od 8 miliona
                      </p>
                    </div>
                    <Switch
                      checked={profile?.email_limit_8m_warning ?? true}
                      onCheckedChange={(checked) => updateEmailPreference('email_limit_8m_warning', checked)}
                      disabled={updatingEmail === 'email_limit_8m_warning'}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab (Bookkeepers only) */}
        {isBookkeeper && (
          <TabsContent value="earnings" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalReferrals}</p>
                      <p className="text-sm text-muted-foreground">Ukupno klijenata</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{activeClients}</p>
                      <p className="text-sm text-muted-foreground">Aktivnih klijenata</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalEarned.toLocaleString('sr-RS')} RSD</p>
                      <p className="text-sm text-muted-foreground">Ukupna zarada</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{pendingEarnings.toLocaleString('sr-RS')} RSD</p>
                      <p className="text-sm text-muted-foreground">Na čekanju</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Referral Link */}
            <Card>
              <CardHeader>
                <CardTitle>Referral link</CardTitle>
                <CardDescription>
                  Podelite ovaj link sa potencijalnim klijentima. Kada se registruju i plate pretplatu, 
                  automatski ćete dobiti 20% provizije.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm overflow-x-auto">
                    {getReferralLink()}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Referred Clients List */}
            <Card>
              <CardHeader>
                <CardTitle>Pozvani klijenti</CardTitle>
                <CardDescription>
                  Lista klijenata koji su se registrovali preko vašeg referral linka
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingReferrals ? (
                  <p className="text-muted-foreground">Učitavanje...</p>
                ) : referrals && referrals.length > 0 ? (
                  <div className="space-y-3">
                    {referrals.map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{referral.client?.full_name || referral.client?.email}</p>
                          <p className="text-sm text-muted-foreground">{referral.client?.company_name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            referral.client?.subscription_end && new Date(referral.client.subscription_end) > new Date()
                              ? 'default'
                              : 'secondary'
                          }>
                            {referral.client?.subscription_end && new Date(referral.client.subscription_end) > new Date()
                              ? 'Aktivan'
                              : referral.client?.is_trial ? 'Trial' : 'Neaktivan'
                            }
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Registrovan {format(new Date(referral.referred_at), 'dd.MM.yyyy.')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Još nema pozvanih klijenata</p>
                    <p className="text-sm">Podelite vaš referral link da biste privukli klijente</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

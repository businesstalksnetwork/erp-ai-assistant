import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Building2, Calculator, Mail, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { useTheme } from '@/lib/theme-context';
import logoLight from '@/assets/pausal-box-logo-light.png';
import logoDark from '@/assets/pausal-box-logo-dark.png';
const emailSchema = z.string().email('Unesite validnu email adresu');
const passwordSchema = z.string()
  .min(8, 'Lozinka mora imati najmanje 8 karaktera')
  .regex(/[a-zA-Z]/, 'Lozinka mora sadržati najmanje jedno slovo')
  .regex(/[0-9]/, 'Lozinka mora sadržati najmanje jedan broj')
  .regex(/[^a-zA-Z0-9]/, 'Lozinka mora sadržati najmanje jedan specijalan karakter (!@#$%^&*...)');

// Weak password check - for users with legacy weak passwords
const isWeakPassword = (password: string): boolean => {
  const strongPasswordResult = passwordSchema.safeParse(password);
  return !strongPasswordResult.success;
};

type AuthMode = 'default' | 'forgot-password' | 'reset-password';
type AccountType = 'pausal' | 'bookkeeper';

// Anti-spam: Block disposable email domains
const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 
  '10minutemail.com', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'yopmail.com', 'temp-mail.org',
  'disposablemail.com', 'trashmail.com', 'getnada.com',
  'mohmal.com', 'tempail.com', 'emailondeck.com', 'sharklasers.com',
  'guerrillamail.info', 'grr.la', 'guerrillamail.biz', 'guerrillamail.de',
  'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'getairmail.com',
  'mailnesia.com', 'tmpmail.org', 'tmpmail.net', 'discard.email',
  'mailcatch.com', 'mintemail.com', 'mt2009.com', 'nospam.ze.tc',
  'owlymail.com', 'rmqkr.net', 'jetable.org', 'spamgourmet.com',
  'tempinbox.com', 'fakemailgenerator.com', 'emailfake.com', 'tempr.email',
  'dropmail.me', 'mailnull.com', 'spambox.us', 'incognitomail.com'
];

const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? BLOCKED_EMAIL_DOMAINS.includes(domain) : false;
};

const isPasswordRecoveryUrl = () => {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  return hash.includes('type=recovery') || hash.includes('access_token') || params.get('type') === 'recovery';
};

const getInitialMode = (): AuthMode => (isPasswordRecoveryUrl() ? 'reset-password' : 'default');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const logo = theme === 'dark' ? logoDark : logoLight;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    fullName?: string; 
    confirmPassword?: string; 
    pib?: string; 
    companyName?: string;
    agencyName?: string;
    agencyPib?: string;
  }>({});
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [accountType, setAccountType] = useState<AccountType>('pausal');
  const [showEmailVerificationMessage, setShowEmailVerificationMessage] = useState(false);
  const [registeredUserData, setRegisteredUserData] = useState<{ userId: string; email: string; fullName: string } | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number>(0);
  
  // Password reset cooldown state
  const [lastResetTime, setLastResetTime] = useState<number>(0);
  const [resetCountdown, setResetCountdown] = useState<number>(0);
  
  // Get referral ID, partner code and plan from URL if present
  const referralId = searchParams.get('ref');
  const partnerCode = searchParams.get('partner');
  const planParam = searchParams.get('plan');

  const isRecovery = isPasswordRecoveryUrl();

  // Save plan param to localStorage when user opens page
  useEffect(() => {
    if (planParam) {
      localStorage.setItem('pendingPlan', planParam);
    }
  }, [planParam]);

  // Password reset countdown timer
  useEffect(() => {
    if (resetCountdown <= 0) return;
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastResetTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setResetCountdown(remaining);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [resetCountdown, lastResetTime]);

  useEffect(() => {
    if (user && mode !== 'reset-password' && !isRecovery) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, mode, isRecovery, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const type = params.get('type');

    if (type === 'recovery' && code) {
      setLoading(true);
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            toast({
              title: 'Greška',
              description: error.message,
              variant: 'destructive',
            });
            setMode('default');
            navigate('/auth', { replace: true });
            return;
          }
          navigate('/auth?type=recovery', { replace: true });
          setMode('reset-password');
        })
        .finally(() => setLoading(false));
    }
  }, [navigate, toast]);

  const validateForm = (
    email: string, 
    password: string, 
    fullName?: string, 
    accountType?: AccountType,
    fields?: { pib?: string; companyName?: string; agencyName?: string; agencyPib?: string },
    isLoginForm?: boolean
  ) => {
    const newErrors: typeof errors = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    // For login, only require minimum length (allow weak passwords for existing users)
    // For signup, enforce full password strength
    if (isLoginForm) {
      if (password.length < 6) {
        newErrors.password = 'Lozinka mora imati najmanje 6 karaktera';
      }
    } else {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }
    
    if (fullName !== undefined && fullName.trim().length < 2) {
      newErrors.fullName = 'Ime mora imati najmanje 2 karaktera';
    }

    if (accountType === 'pausal' && fields) {
      if (fields.pib !== undefined) {
        const pibTrimmed = fields.pib.trim();
        if (!/^\d{9}$/.test(pibTrimmed)) {
          newErrors.pib = 'PIB mora imati tačno 9 cifara';
        }
      }
      if (fields.companyName !== undefined && fields.companyName.trim().length < 2) {
        newErrors.companyName = 'Naziv firme mora imati najmanje 2 karaktera';
      }
    }

    if (accountType === 'bookkeeper' && fields) {
      if (fields.agencyName !== undefined && fields.agencyName.trim().length < 2) {
        newErrors.agencyName = 'Naziv agencije mora imati najmanje 2 karaktera';
      }
      if (fields.agencyPib !== undefined) {
        const agencyPibTrimmed = fields.agencyPib.trim();
        if (!/^\d{9}$/.test(agencyPibTrimmed)) {
          newErrors.agencyPib = 'PIB agencije mora imati tačno 9 cifara';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    // Anti-bot honeypot check (hidden field)
    const honeypot = formData.get('website') as string;
    if (honeypot) {
      // Bot filled the honeypot - silently reject
      setLoading(false);
      return;
    }

    // Use isLoginForm=true to allow weak passwords for existing users
    if (!validateForm(email, password, undefined, undefined, undefined, true)) {
      setLoading(false);
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      let errorMessage = error.message;
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'Pogrešan email ili lozinka';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Molimo vas da prvo potvrdite vašu email adresu. Proverite inbox za link za potvrdu.';
      }
      toast({
        title: 'Greška pri prijavi',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    // Check if user has a weak password and show notification
    if (isWeakPassword(password)) {
      toast({
        title: 'Slaba lozinka',
        description: 'Vaša lozinka je slaba. Preporučujemo da je promenite u Profil → Bezbednost za bolju zaštitu naloga.',
        duration: 10000,
      });
    }
    
    navigate('/dashboard');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    
    // Anti-bot honeypot check (hidden field)
    const honeypot = formData.get('website') as string;
    if (honeypot) {
      // Bot filled the honeypot - silently reject
      setLoading(false);
      return;
    }
    
    // Anti-spam: Block disposable email domains
    if (isDisposableEmail(email)) {
      toast({
        title: 'Nevalidna email adresa',
        description: 'Nije dozvoljeno korišćenje privremenih email servisa za registraciju.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    // Fields based on account type
    const pib = accountType === 'pausal' ? formData.get('pib') as string : undefined;
    const companyName = accountType === 'pausal' ? formData.get('companyName') as string : undefined;
    const agencyName = accountType === 'bookkeeper' ? formData.get('agencyName') as string : undefined;
    const agencyPib = accountType === 'bookkeeper' ? formData.get('agencyPib') as string : undefined;

    if (!validateForm(email, password, fullName, accountType, { pib, companyName, agencyName, agencyPib })) {
      setLoading(false);
      return;
    }

    // Validate PIB via Checkpoint API before registration
    const pibToValidate = accountType === 'pausal' ? pib : agencyPib;
    if (pibToValidate && pibToValidate.trim()) {
      try {
        const { data: validationResult, error: validationError } = await supabase.functions.invoke('validate-pib', {
          body: { pib: pibToValidate.trim() }
        });
        
        if (validationError) {
          console.error('PIB validation error:', validationError);
          toast({
            title: 'Greška pri proveri PIB-a',
            description: 'Nije moguće proveriti PIB. Pokušajte ponovo.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        if (!validationResult?.valid) {
          toast({
            title: 'Nevalidan PIB',
            description: validationResult?.error || 'PIB nije pronađen u registru aktivnih firmi.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        console.log('PIB validated successfully:', validationResult.companyName);
      } catch (err) {
        console.error('PIB validation exception:', err);
        toast({
          title: 'Greška pri proveri PIB-a',
          description: 'Nije moguće proveriti PIB. Pokušajte ponovo.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          pib: accountType === 'pausal' ? pib : '',
          company_name: accountType === 'pausal' ? companyName : '',
          account_type: accountType,
          agency_name: agencyName,
          agency_pib: agencyPib,
          invited_by_user_id: referralId || undefined,
          partner_code: partnerCode || undefined,
        },
      },
    });

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'Korisnik sa ovim emailom već postoji';
      }
      toast({
        title: 'Greška pri registraciji',
        description: message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // If signup successful, send custom verification email via Resend
    if (data.user) {
      try {
        const { error: verificationError } = await supabase.functions.invoke('send-verification-email', {
          body: {
            user_id: data.user.id,
            email: email,
            full_name: fullName,
          },
        });

        if (verificationError) {
          console.error('Error sending verification email:', verificationError);
          toast({
            title: 'Upozorenje',
            description: 'Nalog je kreiran, ali nije bilo moguće poslati verifikacioni email. Kontaktirajte podršku.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Potvrdite email adresu',
            description: 'Poslali smo vam email sa verification@pausalbox.rs. Proverite inbox i potvrdite email adresu pre prijave.',
            duration: 10000,
          });
          setLastResendTime(Date.now());
        }
        setRegisteredUserData({ userId: data.user.id, email, fullName });
        setShowEmailVerificationMessage(true);
      } catch (err) {
        console.error('Error invoking verification function:', err);
        toast({
          title: 'Upozorenje',
          description: 'Nalog je kreiran, ali nije bilo moguće poslati verifikacioni email.',
          variant: 'destructive',
        });
        setRegisteredUserData({ userId: data.user.id, email, fullName });
        setShowEmailVerificationMessage(true);
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if already in cooldown
    if (resetCountdown > 0) {
      toast({
        title: 'Molimo sačekajte',
        description: `Možete zatražiti novi link za ${resetCountdown} sekundi.`,
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setErrors({ email: emailResult.error.errors[0].message });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });

    if (error) {
      // Handle rate limit error specifically
      if (error.message.toLowerCase().includes('rate limit')) {
        setLastResetTime(Date.now());
        setResetCountdown(60);
        toast({
          title: 'Previše zahteva',
          description: 'Molimo sačekajte 60 sekundi pre nego što ponovo zatražite reset lozinke.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Greška',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      // Success - start cooldown
      setLastResetTime(Date.now());
      setResetCountdown(60);
      toast({
        title: 'Email poslat',
        description: 'Poslali smo vam link za reset lozinke na email.',
      });
      setMode('default');
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setErrors({ password: passwordResult.error.errors[0].message });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Lozinke se ne poklapaju' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Lozinka promenjena',
        description: 'Vaša lozinka je uspešno promenjena. Prijavite se novom lozinkom.',
      });
      navigate('/auth', { replace: true });
      await supabase.auth.signOut();
      setMode('default');
    }

    setLoading(false);
  };

  // Reset password form
  if (mode === 'reset-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-block">
              <img src={logo} alt="Paušal box" className="h-12" />
            </Link>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Nova lozinka</CardTitle>
              <CardDescription>
                Unesite novu lozinku za vaš nalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-password">Nova lozinka</Label>
                  <Input
                    id="reset-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Potvrdi lozinku</Label>
                  <Input
                    id="reset-confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Promeni lozinku
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (mode === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-block">
              <img src={logo} alt="Paušal box" className="h-12" />
            </Link>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Zaboravljena lozinka</CardTitle>
              <CardDescription>
                Unesite email adresu i poslaćemo vam link za reset lozinke
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    name="email"
                    type="email"
                    placeholder="vas@email.com"
                    required
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading || resetCountdown > 0}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {resetCountdown > 0 ? `Sačekajte ${resetCountdown}s` : 'Pošalji link'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode('default')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Nazad na prijavu
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <img src={logo} alt="Paušal box" className="h-12" />
          </Link>
          <p className="text-muted-foreground">
            Aplikacija za preduzetnike paušalce
          </p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Dobrodošli</CardTitle>
            <CardDescription>
              Prijavite se ili kreirajte novi nalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Prijava</TabsTrigger>
                <TabsTrigger value="signup">Registracija</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Honeypot field - hidden from users, visible to bots */}
                  <input 
                    type="text" 
                    name="website" 
                    style={{ display: 'none' }} 
                    tabIndex={-1} 
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="vas@email.com"
                      required
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Lozinka</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Prijavi se
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setMode('forgot-password')}
                  >
                    Zaboravili ste lozinku?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {showEmailVerificationMessage ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Proverite vaš email</h3>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        Poslali smo vam email sa linkom za potvrdu. Kliknite na link u emailu da biste aktivirali vaš nalog.
                      </p>
                      <div className="bg-primary/10 text-primary font-medium py-2 px-4 rounded-lg inline-block mt-2">
                        🎉 Dobili ste 14 dana besplatnog korišćenja!
                      </div>
                    </div>
                    <div className="pt-4 border-t space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Niste dobili email? Proverite spam folder.
                      </p>
                      {registeredUserData && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={resendLoading || (Date.now() - lastResendTime < 60000)}
                          onClick={async () => {
                            setResendLoading(true);
                            try {
                              const { error } = await supabase.functions.invoke('send-verification-email', {
                                body: {
                                  user_id: registeredUserData.userId,
                                  email: registeredUserData.email,
                                  full_name: registeredUserData.fullName,
                                },
                              });
                              if (error) {
                                toast({
                                  title: 'Greška',
                                  description: 'Nije moguće poslati email. Pokušajte ponovo.',
                                  variant: 'destructive',
                                });
                              } else {
                                setLastResendTime(Date.now());
                                toast({
                                  title: 'Email poslat',
                                  description: 'Novi verifikacioni email je poslat.',
                                });
                              }
                            } catch {
                              toast({
                                title: 'Greška',
                                description: 'Nije moguće poslati email.',
                                variant: 'destructive',
                              });
                            }
                            setResendLoading(false);
                          }}
                        >
                          {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Mail className="mr-2 h-4 w-4" />
                          {Date.now() - lastResendTime < 60000 
                            ? `Sačekajte ${Math.ceil((60000 - (Date.now() - lastResendTime)) / 1000)}s`
                            : 'Pošalji ponovo'
                          }
                        </Button>
                      )}
                      <div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setShowEmailVerificationMessage(false);
                            setRegisteredUserData(null);
                          }}
                        >
                          Registruj se sa drugim emailom
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                <>
                  {/* Free trial banner */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center mb-4">
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                      ✨ Registrujte se i koristite aplikaciju 14 dana potpuno besplatno!
                    </p>
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {/* Honeypot field - hidden from users, visible to bots */}
                    <input 
                      type="text" 
                      name="website" 
                      style={{ display: 'none' }} 
                      tabIndex={-1} 
                      autoComplete="off"
                      aria-hidden="true"
                    />
                    {/* Account Type Selection */}
                    <div className="space-y-3">
                      <Label>Tip naloga *</Label>
                      <RadioGroup
                        value={accountType}
                        onValueChange={(value) => setAccountType(value as AccountType)}
                        className="grid grid-cols-2 gap-3"
                      >
                        <Label
                          htmlFor="type-pausal"
                          className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                            accountType === 'pausal' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="pausal" id="type-pausal" className="sr-only" />
                          <Building2 className="h-6 w-6 mb-2" />
                          <span className="font-medium">Paušalac</span>
                        </Label>
                        <Label
                          htmlFor="type-bookkeeper"
                          className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                            accountType === 'bookkeeper' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="bookkeeper" id="type-bookkeeper" className="sr-only" />
                          <Calculator className="h-6 w-6 mb-2" />
                          <span className="font-medium">Knjigovođa</span>
                        </Label>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Ime i prezime *</Label>
                      <Input
                        id="signup-name"
                        name="fullName"
                        type="text"
                        placeholder="Marko Marković"
                        required
                      />
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>

                    {/* Dynamic fields based on account type */}
                    {accountType === 'pausal' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="signup-company">Naziv firme *</Label>
                          <Input
                            id="signup-company"
                            name="companyName"
                            type="text"
                            placeholder="PR Marko Marković"
                            required
                          />
                          {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-pib">PIB *</Label>
                          <Input
                            id="signup-pib"
                            name="pib"
                            type="text"
                            placeholder="123456789"
                            required
                          />
                          {errors.pib && <p className="text-sm text-destructive">{errors.pib}</p>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="signup-agency">Naziv agencije *</Label>
                          <Input
                            id="signup-agency"
                            name="agencyName"
                            type="text"
                            placeholder="Knjigovodstvena agencija XYZ"
                            required
                          />
                          {errors.agencyName && <p className="text-sm text-destructive">{errors.agencyName}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-agency-pib">PIB agencije *</Label>
                          <Input
                            id="signup-agency-pib"
                            name="agencyPib"
                            type="text"
                            placeholder="123456789"
                            required
                          />
                          {errors.agencyPib && <p className="text-sm text-destructive">{errors.agencyPib}</p>}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email *</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="vas@email.com"
                        required
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Lozinka *</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                      />
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                      <p className="text-xs text-muted-foreground">
                        Min. 8 karaktera, slova, brojevi i specijalni karakter
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Registruj se
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {accountType === 'bookkeeper' 
                        ? 'Korišćenje aplikacije je besplatno za knjigovođe. Zaradite 20% od pretplata vaših klijenata!'
                        : 'Nakon registracije dobijate 14 dana besplatnog probnog perioda.'
                      }
                    </p>
                  </form>
                </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSelectedCompany } from '@/lib/company-context';
import { useTheme } from '@/lib/theme-context';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CompanySelector } from '@/components/CompanySelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  BookOpen,
  Bell,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
  Shield,
  Briefcase,
  Moon,
  Sun,
  Calculator,
  ChevronRight,
  BarChart3,
  ListChecks,
  FileStack,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { SubscriptionBanner } from '@/components/SubscriptionBanner';
import { BlockedUserScreen } from '@/components/BlockedUserScreen';
import logoLight from '@/assets/pausal-box-logo-light.png';
import logoDark from '@/assets/pausal-box-logo-dark.png';
import logoLightSidebar from '@/assets/pausal-box-logo-light-sidebar.png';

const baseNavItems = [
  { href: '/dashboard', label: 'Kontrolna tabla', icon: LayoutDashboard },
  { href: '/invoices', label: 'Fakture', icon: FileText },
  { href: '/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/kpo', label: 'KPO Knjiga', icon: BookOpen },
  { href: '/reminders', label: 'Podsetnici', icon: Bell },
  { href: '/companies', label: 'Firme', icon: Building2 },
  { href: '/clients', label: 'Klijenti', icon: Users },
  { href: '/services', label: 'Šifarnik', icon: ListChecks },
];

const adminNavItems = [
  { href: '/admin', label: 'Admin Panel', icon: Shield },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, profile, isBlocked, subscriptionDaysLeft, isSubscriptionExpired } = useAuth();
  const { selectedCompany, setSelectedCompany, companies, myCompanies, clientCompanies, isViewingClientCompany } = useSelectedCompany();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { upcomingCount, hasPermission, canRequest, requestPermission } = useNotifications(selectedCompany?.id || null);

  // Request notification permission when user logs in
  useEffect(() => {
    if (canRequest) {
      requestPermission();
    }
  }, [canRequest]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Build dynamic navigation based on company settings
  const getFilteredNavItems = () => {
    const items = [...baseNavItems];
    
    // Find position after Analitika to insert conditional items
    const analyticsIndex = items.findIndex(i => i.href === '/analytics');
    const insertPosition = analyticsIndex + 1;
    
    const conditionalItems = [];
    
    // SEF Centar - only if sef_enabled is true
    if (selectedCompany?.sef_enabled) {
      conditionalItems.push({ href: '/sef', label: 'SEF Centar', icon: FileStack });
    }
    
    // Fiskalna kasa - only if fiscal_enabled is true
    if (selectedCompany?.fiscal_enabled) {
      conditionalItems.push({ href: '/fiscal', label: 'Fiskalna kasa', icon: Calculator });
    }
    
    // Insert conditional items after Analitika
    items.splice(insertPosition, 0, ...conditionalItems);
    
    return items;
  };

  const navItems = isAdmin ? [...getFilteredNavItems(), ...adminNavItems] : getFilteredNavItems();

  // Show blocked screen for blocked users (except admins)
  if (isBlocked && !isAdmin) {
    return <BlockedUserScreen reason={profile?.block_reason || null} onSignOut={handleSignOut} />;
  }

  // Check if subscription banner should show
  const showSubscriptionBanner = !isAdmin && profile?.subscription_end && subscriptionDaysLeft <= 7;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between print:hidden shadow-sm">
        <Link to="/dashboard" className="transition-transform hover:scale-105">
          <img src={theme === 'dark' ? logoDark : logoLightSidebar} alt="Paušal box" className="h-10" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="hover:bg-primary/10"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      
      {/* Mobile header accent line */}
      <div className="lg:hidden fixed top-[60px] left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 z-50 print:hidden" />

      {/* Subscription Banner - below mobile header on mobile, at top on desktop */}
      {showSubscriptionBanner && (
        <div className="lg:fixed lg:top-0 lg:left-64 lg:right-0 lg:z-40 fixed top-[60px] left-0 right-0 z-40 print:hidden">
          <SubscriptionBanner
            subscriptionEnd={profile.subscription_end}
            daysLeft={subscriptionDaysLeft}
            isExpired={isSubscriptionExpired}
          />
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen-safe w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 print:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
            <img src={theme === 'dark' ? logoDark : logoLightSidebar} alt="Paušal box" className="w-full max-w-[200px]" />
            </Link>
          </div>

          {/* Company Selector */}
          {companies.length > 0 && (
            <div className="p-4 border-b border-sidebar-border">
              {isViewingClientCompany && (
                <div className="mb-2 px-2 py-1 bg-primary/10 rounded text-xs text-primary font-medium">
                  Pregledaš firmu klijenta: {selectedCompany?.client_name}
                </div>
              )}
              <CompanySelector
                selectedCompany={selectedCompany}
                myCompanies={myCompanies}
                clientCompanies={clientCompanies}
                onSelect={setSelectedCompany}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const showBadge = item.href === '/reminders' && upcomingCount > 0;
              return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1'
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                    {item.label}
                    {showBadge && (
                      <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0.5 min-w-[20px] justify-center animate-pulse-slow">
                        {upcomingCount}
                      </Badge>
                    )}
                  </Link>
              );
            })}
          </nav>

          {/* User Dropdown Menu */}
          <div className="p-4 border-t border-sidebar-border flex-shrink-0 pb-safe">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent px-3 py-2"
                >
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="font-medium truncate w-full">
                      {profile?.full_name || profile?.email}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60">
                      {profile?.status === 'pending' ? 'Čeka odobrenje' : isAdmin ? 'Administrator' : 'Korisnik'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <ChangePasswordDialog asDropdownItem={true} />
                <DropdownMenuItem onClick={() => { navigate('/bookkeeper'); setMobileMenuOpen(false); }}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Knjigovodstvo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  {theme === 'light' ? 'Tamna tema' : 'Svetla tema'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Odjavi se
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "lg:pl-64 print:pl-0 print:pt-0",
        showSubscriptionBanner ? "pt-[108px] lg:pt-12" : "pt-16 lg:pt-0"
      )}>
        <div className="p-4 lg:p-8 print:p-0">{children}</div>
      </main>
    </div>
  );
}

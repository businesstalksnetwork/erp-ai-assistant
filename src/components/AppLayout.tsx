import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSelectedCompany } from '@/lib/company-context';
import { useTheme } from '@/lib/theme-context';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { CompanySelector } from '@/components/CompanySelector';
import { NotificationBell } from '@/components/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  FileText,
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
  ChevronDown,
  BarChart3,
  ListChecks,
  FileStack,
  Wallet,
  FolderOpen,
  MoreHorizontal,
  User,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { SubscriptionBanner } from '@/components/SubscriptionBanner';
import { BlockedUserScreen } from '@/components/BlockedUserScreen';
import { BookkeeperProfileBanner } from '@/components/BookkeeperProfileBanner';
import logoLight from '@/assets/pausal-box-logo-light.png';
import logoDark from '@/assets/pausal-box-logo-dark.png';
import logoLightSidebar from '@/assets/pausal-box-logo-light-sidebar.png';

// Main navigation items (above separator)
const mainNavItems = [
  { href: '/dashboard', label: 'Kontrolna tabla', icon: LayoutDashboard },
  { href: '/invoices', label: 'Fakture', icon: FileText },
  { href: '/kpo', label: 'KPO Knjiga', icon: BookOpen },
  { href: '/reminders', label: 'Podsetnici', icon: Bell },
  { href: '/clients', label: 'Klijenti', icon: Users },
  { href: '/documents', label: 'Dokumentacija', icon: FolderOpen },
  { href: '/services', label: 'Šifarnik', icon: ListChecks },
  { href: '/invoice-analytics', label: 'Analitika', icon: BarChart3 },
];

// Secondary navigation items (below separator) - dynamically built in getFilteredNavItems
const bookkeepingNavItem = { href: '/bookkeeper', label: 'Knjigovodstvo', icon: Briefcase };

// Admin-only navigation items
const adminNavItems = [
  { href: '/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/payouts', label: 'Isplata', icon: Wallet },
  { href: '/admin', label: 'Admin Panel', icon: Shield },
];

// Mobile bottom nav items
const mobileBottomNavItems = [
  { href: '/dashboard', label: 'Početna', icon: LayoutDashboard },
  { href: '/invoices', label: 'Fakture', icon: FileText },
  { href: '/reminders', label: 'Podsetnici', icon: Bell },
  { href: '/profile', label: 'Profil', icon: User },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, profile, isBlocked, subscriptionDaysLeft, isSubscriptionExpired, isBookkeeper } = useAuth();
  const { selectedCompany, setSelectedCompany, companies, myCompanies, clientCompanies, isViewingClientCompany } = useSelectedCompany();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { upcomingCount, hasPermission, canRequest, requestPermission } = useNotifications(selectedCompany?.id || null);
  
  // Track previous company id to detect changes
  const prevCompanyIdRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  // Request notification permission when user logs in
  useEffect(() => {
    if (canRequest) {
      requestPermission();
    }
  }, [canRequest]);

  // Redirect to /dashboard when switching to a client company
  useEffect(() => {
    if (!selectedCompany?.id || isViewingClientCompany === undefined) return;
    
    if (isInitialMount.current) {
      prevCompanyIdRef.current = selectedCompany.id;
      isInitialMount.current = false;
      return;
    }
    
    const companyChanged = prevCompanyIdRef.current !== selectedCompany.id;
    prevCompanyIdRef.current = selectedCompany.id;
    
    if (companyChanged && isViewingClientCompany && location.pathname !== '/dashboard') {
      navigate('/dashboard', { replace: true });
    }
  }, [selectedCompany?.id, isViewingClientCompany, navigate, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Build dynamic navigation based on company settings
  const getFilteredNavItems = () => {
    const items = [...mainNavItems];
    
    const kpoIndex = items.findIndex(i => i.href === '/kpo');
    const insertPosition = kpoIndex + 1;
    
    const conditionalItems = [];
    
    if (selectedCompany?.sef_enabled) {
      conditionalItems.push({ href: '/sef', label: 'SEF Centar', icon: FileStack });
    }
    
    if (selectedCompany?.fiscal_enabled) {
      conditionalItems.push({ href: '/fiscal', label: 'Fiskalna kasa', icon: Calculator });
    }
    
    items.splice(insertPosition, 0, ...conditionalItems);
    
    const maxCompanies = profile?.max_companies ?? 1;
    const companyLabel = myCompanies.length > 1 || maxCompanies > 1 
      ? 'Moje Kompanije' 
      : 'Moja Kompanija';
    
    const profileGroup = [];
    profileGroup.push({ href: '/companies', label: companyLabel, icon: Building2 });
    
    if (!isBookkeeper) {
      profileGroup.push(bookkeepingNavItem);
    }
    
    const adminGroup = isAdmin ? adminNavItems : [];
    
    return { main: items, profileGroup, adminGroup };
  };

  const filteredNavItems = getFilteredNavItems();

  if (isBlocked && !isAdmin) {
    return <BlockedUserScreen reason={profile?.block_reason || null} onSignOut={handleSignOut} />;
  }

  const showSubscriptionBanner = !isAdmin && !isBookkeeper && profile?.subscription_end && subscriptionDaysLeft <= 7;
  const showBookkeeperBanner = isBookkeeper && (
    !(profile as any)?.bookkeeper_company_name ||
    !(profile as any)?.bookkeeper_pib ||
    !(profile as any)?.bookkeeper_bank_account
  );

  const userRole = profile?.status === 'pending' ? 'Čeka odobrenje' : isAdmin ? 'Administrator' : isBookkeeper ? 'Knjigovođa' : 'Korisnik';

  return (
    <div className="min-h-screen bg-background print:min-h-0 print:h-auto print:bg-white">
      {/* Bookkeeper Profile Banner */}
      <BookkeeperProfileBanner />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between print:hidden shadow-sm">
        <Link to="/dashboard" className="transition-transform hover:scale-105">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Paušal box" className="h-10" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
        </div>
      </div>
      
      {/* Mobile header accent line */}
      <div className="lg:hidden fixed top-[60px] left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 z-50 print:hidden" />

      {/* Subscription Banner */}
      {showSubscriptionBanner && (
        <div className="lg:fixed lg:top-14 lg:left-64 lg:right-0 lg:z-40 fixed top-[60px] left-0 right-0 z-40 print:hidden">
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
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
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

          {/* Bookkeeper quick access */}
          {isBookkeeper && (
            <div className="px-4 pt-4 pb-2">
              <Link
                to="/bookkeeper"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  location.pathname === '/bookkeeper'
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1'
                )}
              >
                <Briefcase className={cn("h-5 w-5 transition-transform", location.pathname === '/bookkeeper' && "scale-110")} />
                Knjigovodstvo
              </Link>
              <Separator className="mt-3 bg-sidebar-border" />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {/* Main navigation */}
            {filteredNavItems.main.map((item) => {
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

            <Separator className="my-3 bg-sidebar-border" />

            {/* Profile group */}
            {filteredNavItems.profileGroup.map((item) => {
              const isActive = location.pathname === item.href;
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
                </Link>
              );
            })}

            {/* Admin section */}
            {filteredNavItems.adminGroup.length > 0 && (
              <>
                <Separator className="my-3 bg-sidebar-border" />
                {filteredNavItems.adminGroup.map((item) => {
                  const isActive = location.pathname === item.href;
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
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Desktop Header Bar */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 z-40 h-14 bg-card border-b border-border items-center justify-end px-6 gap-3 print:hidden">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto">
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-medium leading-tight">
                  {profile?.full_name || profile?.email}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {userRole}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Moj Profil
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
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        data-testid="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe print:hidden"
      >
        <div className="flex items-center justify-around h-14">
          {mobileBottomNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const showBadge = item.href === '/reminders' && upcomingCount > 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors relative',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                {isActive && <span>{item.label}</span>}
                {showBadge && (
                  <span className="absolute top-1 right-1/4 w-2 h-2 bg-destructive rounded-full" />
                )}
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium text-muted-foreground transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={cn(
        "lg:pl-64 print:pl-0 print:pt-0 print:p-0 print:m-0",
        "lg:pt-14",
        showSubscriptionBanner ? "pt-[108px]" : "pt-16",
        showBookkeeperBanner && "pt-[108px]",
        "pb-16 lg:pb-0" // Add bottom padding for mobile bottom nav
      )}>
        <div className="p-4 lg:p-8 print:p-0 print:m-0">{children}</div>
      </main>
    </div>
  );
}

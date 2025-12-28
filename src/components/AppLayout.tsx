import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSelectedCompany } from '@/lib/company-context';
import { useTheme } from '@/lib/theme-context';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const userNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Fakture', icon: FileText },
  { href: '/invoices/new', label: 'Nova faktura', icon: FilePlus },
  { href: '/kpo', label: 'KPO Knjiga', icon: BookOpen },
  { href: '/fiscal', label: 'Fiskalna kasa', icon: Calculator },
  { href: '/reminders', label: 'Podsetnici', icon: Bell },
  { href: '/companies', label: 'Firme', icon: Building2 },
  { href: '/clients', label: 'Klijenti', icon: Users },
  { href: '/bookkeeper', label: 'Knjigovodstvo', icon: Briefcase },
];

const adminNavItems = [
  { href: '/admin', label: 'Admin Panel', icon: Shield },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, profile } = useAuth();
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

  const navItems = isAdmin ? [...userNavItems, ...adminNavItems] : userNavItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-primary">
          <FileText className="h-6 w-6" />
          PaušalApp
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

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
          'fixed top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-bold text-xl text-sidebar-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              <FileText className="h-7 w-7" />
              PaušalApp
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
              <Select
                value={selectedCompany?.id}
                onValueChange={(value) => {
                  const company = companies.find((c) => c.id === value);
                  if (company) setSelectedCompany(company);
                }}
              >
                <SelectTrigger className="w-full bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                  <SelectValue placeholder="Izaberi firmu" />
                </SelectTrigger>
                <SelectContent>
                  {myCompanies.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Moje firme
                      </div>
                      {myCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {clientCompanies.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Firme klijenata
                      </div>
                      {clientCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          <span>{company.name}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({company.client_name})</span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {showBadge && (
                    <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0.5 min-w-[20px] justify-center">
                      {upcomingCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <div className="px-3 py-2 text-sm">
              <p className="font-medium truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile?.status === 'pending' ? 'Čeka odobrenje' : isAdmin ? 'Administrator' : 'Korisnik'}
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Tamna tema
                </>
              ) : (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Svetla tema
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Odjavi se
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

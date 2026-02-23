import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

const DISMISS_KEY = 'bookkeeper_profile_banner_dismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function BookkeeperProfileBanner() {
  const { profile, isBookkeeper } = useAuth();
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      setIsDismissed(elapsed < DISMISS_DURATION);
    } else {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  };

  // Only show for bookkeepers without complete company data
  const needsProfileData = isBookkeeper && (
    !(profile as any)?.bookkeeper_company_name ||
    !(profile as any)?.bookkeeper_pib ||
    !(profile as any)?.bookkeeper_bank_account
  );

  if (!needsProfileData || isDismissed) return null;

  return (
    <div className="fixed top-[60px] lg:top-0 left-0 right-0 lg:left-64 z-40 bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-2 flex-1">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm">
          Popunite podatke o vašoj firmi (naziv, PIB, broj računa) da biste primali proviziju od pretplata klijenata.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" asChild>
          <Link to="/profile?tab=company">Popuni podatke</Link>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

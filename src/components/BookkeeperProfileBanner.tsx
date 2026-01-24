import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export function BookkeeperProfileBanner() {
  const { profile, isBookkeeper } = useAuth();

  // Only show for bookkeepers without complete company data
  const needsProfileData = isBookkeeper && (
    !(profile as any)?.bookkeeper_company_name ||
    !(profile as any)?.bookkeeper_pib ||
    !(profile as any)?.bookkeeper_bank_account
  );

  if (!needsProfileData) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm truncate">
          Popunite podatke o vašoj firmi da biste primali proviziju od pretplata
        </span>
      </div>
      <Button variant="secondary" size="sm" asChild className="shrink-0">
        <Link to="/profile?tab=company">Popuni podatke</Link>
      </Button>
    </div>
  );
}

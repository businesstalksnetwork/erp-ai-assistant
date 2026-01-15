import { AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SubscriptionBannerProps {
  subscriptionEnd: string | null;
  daysLeft: number;
  isExpired: boolean;
}

export function SubscriptionBanner({ subscriptionEnd, daysLeft, isExpired }: SubscriptionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show if more than 7 days left or dismissed
  if (daysLeft > 7 || dismissed) return null;

  const formattedDate = subscriptionEnd
    ? format(new Date(subscriptionEnd), 'dd.MM.yyyy.', { locale: sr })
    : '';

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm',
        isExpired
          ? 'bg-destructive/10 border-b border-destructive/20 text-destructive'
          : 'bg-amber-50 border-b border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">
          {isExpired ? (
            <span className="hidden sm:inline">Vaša pretplata je istekla. Kontaktirajte administratora.</span>
          ) : (
            <span className="hidden sm:inline">
              Pretplata ističe za {daysLeft} {daysLeft === 1 ? 'dan' : 'dana'} ({formattedDate}).
            </span>
          )}
          {isExpired ? (
            <span className="sm:hidden">Pretplata istekla</span>
          ) : (
            <span className="sm:hidden">Ističe za {daysLeft} dana</span>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-foreground/10 transition-colors flex-shrink-0"
        title="Zatvori"
      >
        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    </div>
  );
}

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
        'flex items-center justify-between gap-4 px-4 py-3 text-sm',
        isExpired
          ? 'bg-destructive/10 border-b border-destructive/20 text-destructive'
          : 'bg-warning/10 border-b border-warning/20 text-warning-foreground'
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          {isExpired ? (
            <>Vaša pretplata je istekla. Kontaktirajte administratora za produženje.</>
          ) : (
            <>
              Vaša pretplata ističe za {daysLeft} {daysLeft === 1 ? 'dan' : daysLeft < 5 ? 'dana' : 'dana'} ({formattedDate}).
              Kontaktirajte administratora za produženje.
            </>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-foreground/10 transition-colors"
        title="Zatvori"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

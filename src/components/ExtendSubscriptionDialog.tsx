import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from 'lucide-react';

interface ExtendSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string;
    subscription_end: string | null;
  } | null;
  onExtend: (userId: string, months: number) => void;
}

export function ExtendSubscriptionDialog({
  open,
  onOpenChange,
  user,
  onExtend,
}: ExtendSubscriptionDialogProps) {
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);

  if (!user) return null;

  const currentEnd = user.subscription_end ? new Date(user.subscription_end) : new Date();
  const baseDate = currentEnd > new Date() ? currentEnd : new Date();
  const newEndDate = selectedMonths ? addMonths(baseDate, selectedMonths) : null;

  const handleExtend = () => {
    if (selectedMonths) {
      onExtend(user.id, selectedMonths);
      setSelectedMonths(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Produži pretplatu
          </DialogTitle>
          <DialogDescription>
            Izaberite period za produženje pretplate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Trenutno ističe:</p>
            <p className="text-sm font-medium">
              {user.subscription_end
                ? format(new Date(user.subscription_end), 'dd. MMMM yyyy.', { locale: sr })
                : 'Nije postavljeno'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Produži za:</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 6].map((months) => (
                <Button
                  key={months}
                  variant={selectedMonths === months ? 'default' : 'outline'}
                  onClick={() => setSelectedMonths(months)}
                  className="w-full"
                >
                  {months} {months === 1 ? 'mesec' : months < 5 ? 'meseca' : 'meseci'}
                </Button>
              ))}
            </div>
          </div>

          {newEndDate && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-muted-foreground">Novi datum isteka:</p>
              <p className="text-sm font-medium text-success">
                {format(newEndDate, 'dd. MMMM yyyy.', { locale: sr })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleExtend} disabled={!selectedMonths}>
            Produži
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

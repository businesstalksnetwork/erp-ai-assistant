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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ExtendSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string;
    subscription_end: string | null;
    is_trial?: boolean;
    created_at?: string;
  } | null;
  onExtend: (userId: string, months: number, startDate: Date) => void;
}

export function ExtendSubscriptionDialog({
  open,
  onOpenChange,
  user,
  onExtend,
}: ExtendSubscriptionDialogProps) {
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [startDateOption, setStartDateOption] = useState<'trial_end' | 'today' | 'custom'>('trial_end');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  if (!user) return null;

  const today = new Date();
  const trialEndDate = user.subscription_end ? new Date(user.subscription_end) : today;
  
  // Za trial korisnike: mogu birati početni datum
  // Za postojeće pretplatnike: uvek od datuma isteka
  const isTrial = user.is_trial === true;
  
  const getStartDate = () => {
    if (!isTrial) {
      return trialEndDate;
    }
    if (startDateOption === 'custom' && customDate) {
      return customDate;
    }
    return startDateOption === 'trial_end' ? trialEndDate : today;
  };
  
  const startDate = getStartDate();
  const newEndDate = selectedMonths ? addMonths(startDate, selectedMonths) : null;

  const handleExtend = () => {
    if (selectedMonths) {
      onExtend(user.id, selectedMonths, startDate);
      setSelectedMonths(null);
      setStartDateOption('trial_end');
      setCustomDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
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

          {isTrial && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium">Računaj pretplatu od:</p>
              <RadioGroup
                value={startDateOption}
                onValueChange={(value) => setStartDateOption(value as 'trial_end' | 'today' | 'custom')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="trial_end" id="trial_end" />
                  <Label htmlFor="trial_end" className="text-sm cursor-pointer">
                    Isteka triala ({format(trialEndDate, 'dd.MM.yyyy.')})
                    <span className="text-xs text-muted-foreground ml-1">— preporučeno</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="today" id="today" />
                  <Label htmlFor="today" className="text-sm cursor-pointer">
                    Današnjeg dana ({format(today, 'dd.MM.yyyy.')})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="text-sm cursor-pointer">
                    Izaberi datum
                  </Label>
                </div>
              </RadioGroup>
              
              {startDateOption === 'custom' && (
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDate ? format(customDate, 'dd. MMMM yyyy.', { locale: sr }) : 'Izaberi datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      initialFocus
                      locale={sr}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          <div className="space-y-2 relative z-10">
            <p className="text-sm text-muted-foreground">Produži za:</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 6].map((months) => (
                <Button
                  key={months}
                  type="button"
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
          <Button 
            onClick={handleExtend} 
            disabled={!selectedMonths || (startDateOption === 'custom' && !customDate)}
          >
            Produži
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
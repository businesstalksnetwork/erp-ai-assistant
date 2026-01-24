import { useState, useEffect } from 'react';
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
import { Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    max_companies?: number;
    account_type?: string;
  } | null;
  onExtend: (userId: string, months: number, startDate: Date) => void;
  onSetExactDate?: (userId: string, date: Date) => void;
  onUpdateMaxCompanies?: (userId: string, maxCompanies: number) => void;
  onUpdateAccountType?: (userId: string, accountType: 'pausal' | 'bookkeeper') => void;
}

export function ExtendSubscriptionDialog({
  open,
  onOpenChange,
  user,
  onExtend,
  onSetExactDate,
  onUpdateMaxCompanies,
  onUpdateAccountType,
}: ExtendSubscriptionDialogProps) {
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [startDateOption, setStartDateOption] = useState<'trial_end' | 'today' | 'custom'>('trial_end');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [exactDate, setExactDate] = useState<Date | undefined>(undefined);
  const [maxCompanies, setMaxCompanies] = useState<number>(1);
  const [accountType, setAccountType] = useState<'pausal' | 'bookkeeper'>('pausal');
  const [activeTab, setActiveTab] = useState<'extend' | 'exact' | 'companies' | 'account'>('extend');

  // Sync state when user changes or dialog opens
  useEffect(() => {
    if (user && open) {
      setMaxCompanies(user.max_companies || 1);
      setAccountType((user.account_type as 'pausal' | 'bookkeeper') || 'pausal');
      if (user.subscription_end) {
        setExactDate(new Date(user.subscription_end));
      } else {
        setExactDate(undefined);
      }
    }
  }, [user, open]);

  if (!user) return null;

  const today = new Date();
  const trialEndDate = user.subscription_end ? new Date(user.subscription_end) : today;
  
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
      resetAndClose();
    }
  };

  const handleSetExactDate = () => {
    if (exactDate && onSetExactDate) {
      // Create date at noon to avoid timezone issues when converting to ISO string
      const dateAtNoon = new Date(exactDate);
      dateAtNoon.setHours(12, 0, 0, 0);
      onSetExactDate(user.id, dateAtNoon);
      resetAndClose();
    }
  };

  const handleUpdateMaxCompanies = () => {
    if (onUpdateMaxCompanies && maxCompanies >= 1) {
      onUpdateMaxCompanies(user.id, maxCompanies);
      resetAndClose();
    }
  };

  const handleUpdateAccountType = () => {
    if (onUpdateAccountType && accountType !== user?.account_type) {
      onUpdateAccountType(user.id, accountType);
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setSelectedMonths(null);
    setStartDateOption('trial_end');
    setCustomDate(undefined);
    setActiveTab('extend');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Upravljanje pretplatom
          </DialogTitle>
          <DialogDescription>
            Podešavanje pretplate i ograničenja za korisnika
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

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="extend">Produži</TabsTrigger>
              <TabsTrigger value="exact">Datum</TabsTrigger>
              <TabsTrigger value="companies">Firme</TabsTrigger>
              <TabsTrigger value="account">Tip</TabsTrigger>
            </TabsList>

            <TabsContent value="extend" className="space-y-4">
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
                    <div className="border rounded-md bg-background">
                      <Calendar
                        mode="single"
                        selected={customDate}
                        onSelect={setCustomDate}
                        locale={sr}
                        className="rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  💰 Produženje pretplate se beleži kao uplata za analitiku zarade.
                </p>
              </div>

              <div className="space-y-2 relative z-10">
                <p className="text-sm text-muted-foreground">Produži za:</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 6, 12].map((months) => (
                    <Button
                      key={months}
                      type="button"
                      variant={selectedMonths === months ? 'default' : 'outline'}
                      onClick={() => setSelectedMonths(months)}
                      className="w-full"
                    >
                      {months} {months === 1 ? 'mesec' : 'meseci'}
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

              <Button 
                onClick={handleExtend} 
                disabled={!selectedMonths || (startDateOption === 'custom' && !customDate)}
                className="w-full"
              >
                Produži pretplatu
              </Button>
            </TabsContent>

            <TabsContent value="exact" className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border mb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  📝 Ručna korekcija datuma — ne beleži se kao uplata.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Izaberite tačan datum isteka pretplate:</p>
                <div className="border rounded-md bg-background">
                  <Calendar
                    mode="single"
                    selected={exactDate}
                    onSelect={setExactDate}
                    locale={sr}
                    className="rounded-md"
                  />
                </div>
              </div>

              {exactDate && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Novi datum isteka:</p>
                  <p className="text-sm font-medium">
                    {format(exactDate, 'dd. MMMM yyyy.', { locale: sr })}
                  </p>
                </div>
              )}

              <Button 
                onClick={handleSetExactDate} 
                disabled={!exactDate || !onSetExactDate}
                className="w-full"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Postavi datum
              </Button>
            </TabsContent>

            <TabsContent value="companies" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_companies">Maksimalan broj firmi</Label>
                <p className="text-xs text-muted-foreground">
                  Standardno ograničenje je 1 firma po korisniku. 
                  Možete omogućiti korisniku da doda više firmi.
                </p>
                <Input
                  id="max_companies"
                  type="number"
                  min={1}
                  max={100}
                  value={maxCompanies}
                  onChange={(e) => setMaxCompanies(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Trenutno ograničenje:</p>
                <p className="text-sm font-medium">{user.max_companies || 1} firma</p>
              </div>

              <Button 
                onClick={handleUpdateMaxCompanies} 
                disabled={!onUpdateMaxCompanies || maxCompanies < 1}
                className="w-full"
              >
                Sačuvaj ograničenje
              </Button>
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <div className="space-y-3">
                <Label>Tip korisničkog naloga</Label>
                <RadioGroup
                  value={accountType}
                  onValueChange={(v) => setAccountType(v as 'pausal' | 'bookkeeper')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pausal" id="pausal" />
                    <Label htmlFor="pausal" className="cursor-pointer">
                      <span className="font-medium">Paušalac</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        — Standardni korisnik sa pretplatom
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bookkeeper" id="bookkeeper" />
                    <Label htmlFor="bookkeeper" className="cursor-pointer">
                      <span className="font-medium">Knjigovođa</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        — Besplatan pristup, referral program
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {accountType !== user?.account_type && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-muted-foreground">
                    {accountType === 'bookkeeper' 
                      ? 'Korisnik će dobiti besplatan pristup i moći će da upravlja klijentskim kompanijama.'
                      : 'Korisnik će morati da ima aktivnu pretplatu i upravljaće sopstvenim kompanijama.'}
                  </p>
                </div>
              )}

              <Button 
                onClick={handleUpdateAccountType} 
                disabled={!onUpdateAccountType || accountType === user?.account_type}
                className="w-full"
              >
                Sačuvaj tip naloga
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
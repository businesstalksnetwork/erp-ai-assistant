import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSelectedCompany } from '@/lib/company-context';
import { useLimits } from '@/hooks/useLimits';
import { useReminders } from '@/hooks/useReminders';
import { useInvoices } from '@/hooks/useInvoices';
import { useFiscalEntries } from '@/hooks/useFiscalEntries';
import { useKPO } from '@/hooks/useKPO';
import { cn } from '@/lib/utils';
import LimitDetailDialog from '@/components/LimitDetailDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  TrendingUp,
  FileText,
  Bell,
  Plus,
  Building2,
  Clock,
  ArrowRight,
  Sparkles,
  Check,
  Info,
  Store,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// @ts-nocheck
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const { profile, isApproved } = useAuth();
  const { selectedCompany, companies } = useSelectedCompany();
  const { limits, LIMIT_6M, LIMIT_8M } = useLimits(selectedCompany?.id || null);
  const { upcomingReminders, toggleComplete } = useReminders(selectedCompany?.id || null);
  const { invoices } = useInvoices(selectedCompany?.id || null);

  // Get fiscal data for current year
  const currentYear = new Date().getFullYear();
  const { dailySummaries } = useFiscalEntries(selectedCompany?.id || null, currentYear);
  const { entries: kpoEntries } = useKPO(selectedCompany?.id || null);

  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<'6m' | '8m'>('6m');

  const handleToggleReminder = async (id: string) => {
    try {
      await toggleComplete.mutateAsync({ id, is_completed: true });
      toast.success('Podsetnik označen kao plaćen');
    } catch (error) {
      toast.error('Greška pri ažuriranju podsetnika');
    }
  };

  const recentInvoices = invoices.filter(i => !i.is_proforma).slice(0, 5);

  // Izračunaj udeo najvećeg partnera u godišnjem prometu (Test samostalnosti)
  const yearlyRegularInvoices = invoices.filter(i => 
    !i.is_proforma && 
    i.invoice_type === 'regular' && 
    i.year === currentYear
  );

  const clientTotals: Record<string, number> = {};
  
  // Add invoices by client
  yearlyRegularInvoices.forEach(inv => {
    const clientName = inv.client_name;
    clientTotals[clientName] = (clientTotals[clientName] || 0) + inv.total_amount;
  });

  // Add fiscal revenue as "Maloprodaja"
  const fiscalTotal = dailySummaries.reduce((sum, s) => sum + Number(s.total_amount), 0);
  if (fiscalTotal > 0) {
    clientTotals['Maloprodaja'] = fiscalTotal;
  }

  const totalYearlyForIndependence = Object.values(clientTotals).reduce((a, b) => a + b, 0);
  const topClient = Object.entries(clientTotals).sort((a, b) => b[1] - a[1])[0];
  const topClientName = topClient?.[0] || null;
  const topClientAmount = topClient?.[1] || 0;
  const topClientPercent = totalYearlyForIndependence > 0 ? (topClientAmount / totalYearlyForIndependence) * 100 : 0;
  // Don't show warning if top client is "Maloprodaja" (fiscal/retail sales)
  const isIndependenceWarning = topClientPercent > 70 && topClientName !== 'Maloprodaja';

  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Clock className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Vaš nalog čeka odobrenje</h1>
        <p className="text-muted-foreground max-w-md">
          Administrator mora odobriti vaš nalog pre nego što možete koristiti aplikaciju.
          Molimo vas da sačekate.
        </p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Dobrodošli, {profile?.full_name}!</h1>
        <p className="text-muted-foreground max-w-md">
          Da biste počeli sa radom, potrebno je da dodate vašu prvu firmu.
        </p>
        <Button asChild>
          <Link to="/companies">
            <Plus className="mr-2 h-4 w-4" />
            Dodaj firmu
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-fade-in">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">Kontrolna tabla</h1>
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse-slow" />
        </div>
        <p className="text-sm sm:text-base text-muted-foreground truncate">
          Pregled za {selectedCompany?.name}
        </p>
      </div>

      {/* Limits Cards */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* 6M Limit Card */}
        <Card 
          className={cn(
            "card-hover cursor-pointer transition-transform hover:scale-[1.01]",
            limits.limit6MPercent >= 90 ? 'border-destructive bg-destructive/5' : 
            limits.limit6MPercent >= 75 ? 'border-warning bg-warning/5' : ''
          )}
          onClick={() => { setSelectedLimit('6m'); setLimitDialogOpen(true); }}
        >
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-base sm:text-lg leading-tight">Godišnji limit (6M)</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs text-sm" side="bottom" align="start">
                    <p>Prelaskom limita od 6 miliona dinara, preduzetnik paušalac gubi pravo na paušalno oporezivanje.</p>
                    <p className="mt-2">Ako limit pređe u prvoj polovini godine, obaveza vođenja knjiga počinje od <strong>01. jula</strong>, dok u slučaju da limit pređe u drugoj polovini godine, obaveza vođenja knjiga počinje od <strong>01. januara naredne godine</strong>.</p>
                  </PopoverContent>
                </Popover>
              </div>
              {limits.limit6MPercent >= 90 && (
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive animate-pulse-slow flex-shrink-0" />
              )}
            </div>
            <CardDescription className="text-xs sm:text-sm">
              01.01. - 31.12. {new Date().getFullYear()}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                <span className="truncate">Iskorišćeno: {formatCurrency(limits.yearlyTotal)}</span>
                <span className="font-semibold">{limits.limit6MPercent.toFixed(1)}%</span>
              </div>
              <Progress 
                value={limits.limit6MPercent} 
                className={limits.limit6MPercent >= 90 ? '[&>div]:bg-destructive' : limits.limit6MPercent >= 75 ? '[&>div]:bg-warning' : ''}
              />
              <p className="text-xs sm:text-sm text-muted-foreground">
                Preostalo: {formatCurrency(limits.limit6MRemaining)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 8M Limit Card */}
        <Card 
          className={cn(
            "card-hover cursor-pointer transition-transform hover:scale-[1.01]",
            limits.limit8MPercent >= 90 ? 'border-destructive bg-destructive/5' : 
            limits.limit8MPercent >= 75 ? 'border-warning bg-warning/5' : ''
          )}
          onClick={() => { setSelectedLimit('8m'); setLimitDialogOpen(true); }}
        >
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-base sm:text-lg leading-tight">Klizni limit (8M)</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs text-sm" side="bottom" align="start">
                    <p>Prelaskom limita od 8 miliona dinara, nastaje obaveza ulaska u sistem PDV, a ujedno započinje i obaveza vođenja poslovnih knjiga od <strong>prvog narednog dana</strong> u odnosu na dan kad je prekoračen limit.</p>
                  </PopoverContent>
                </Popover>
              </div>
              {limits.limit8MPercent >= 90 && (
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive animate-pulse-slow flex-shrink-0" />
              )}
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Poslednjih 365 dana
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                <span className="truncate">Iskorišćeno: {formatCurrency(limits.rollingDomestic)}</span>
                <span className="font-semibold">{limits.limit8MPercent.toFixed(1)}%</span>
              </div>
              <Progress 
                value={limits.limit8MPercent}
                className={limits.limit8MPercent >= 90 ? '[&>div]:bg-destructive' : limits.limit8MPercent >= 75 ? '[&>div]:bg-warning' : ''}
              />
              <p className="text-xs sm:text-sm text-muted-foreground">
                Preostalo: {formatCurrency(limits.limit8MRemaining)}
              </p>
              {/* Breakdown when KPO exists */}
              {limits.kpoRollingTotal > 0 && (
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5 border-t pt-2">
                  <div className="flex justify-between">
                    <span>Fakture:</span>
                    <span>{formatCurrency(limits.invoiceRollingDomestic)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiskalna kasa:</span>
                    <span>{formatCurrency(limits.fiscalRollingDomestic)}</span>
                  </div>
                  <div className="flex justify-between text-primary font-medium">
                    <span>KPO (uvoz):</span>
                    <span>{formatCurrency(limits.kpoRollingTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Ukupno faktura</CardTitle>
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-primary group-hover:animate-bounce-subtle" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{invoices.filter(i => !i.is_proforma).length}</div>
          </CardContent>
        </Card>

        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Godišnji promet</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-success group-hover:animate-bounce-subtle flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(limits.yearlyTotal)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              Od 01.01.{new Date().getFullYear()}.
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Aktivni podsetnici</CardTitle>
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 text-warning group-hover:animate-bounce-subtle" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{upcomingReminders.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Podsetnici za plaćanje
            </p>
          </CardContent>
        </Card>

        {/* Test samostalnosti */}
        <Card className={cn(
          "card-hover group",
          isIndependenceWarning && "border-destructive bg-destructive/5"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">
              Top klijent
            </CardTitle>
            {isIndependenceWarning ? (
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive animate-pulse-slow" />
            ) : (
              <Check className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
            )}
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className={cn(
              "text-lg sm:text-2xl font-bold",
              isIndependenceWarning ? "text-destructive" : "text-success"
            )}>
              {topClientPercent.toFixed(1)}%
            </div>
            {topClientName && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex items-center gap-1" title={topClientName}>
                {topClientName === 'Maloprodaja' && <Store className="h-3 w-3 text-primary shrink-0" />}
                <span className="truncate">{topClientName}</span>
              </p>
            )}
            {isIndependenceWarning && (
              <Badge variant="destructive" className="mt-1 text-[10px]">
                Upozorenje: Test samostalnost
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <Card className="border-warning bg-warning/5 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-warning animate-bounce-subtle" />
              <CardTitle className="text-base sm:text-lg">
                Podsetnici: {upcomingReminders.length}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              {upcomingReminders.slice(0, 3).map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-secondary/50 rounded-lg border border-transparent hover:border-primary/20 transition-all duration-200 gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleToggleReminder(reminder.id)}
                      aria-label="Označi kao plaćeno"
                      className="border-warning data-[state=checked]:bg-warning flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{reminder.title}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Rok: {new Date(reminder.due_date).toLocaleDateString('sr-RS')}
                      </p>
                    </div>
                  </div>
                  {reminder.amount && (
                    <Badge variant="warning" className="self-end sm:self-auto text-xs sm:text-sm">{formatCurrency(reminder.amount)}</Badge>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-3 group text-sm" asChild>
              <Link to="/reminders">
                Pogledaj sve podsetnike
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6">
          <div>
            <CardTitle className="text-base sm:text-lg">Poslednje fakture</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Vaše najnovije izdate fakture</CardDescription>
          </div>
          <Button asChild className="group w-full sm:w-auto" size="sm">
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
              Nova faktura
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {recentInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nemate još izdatih faktura.
            </p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((invoice, index) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-secondary/50 rounded-lg border border-transparent hover:border-primary/20 hover:bg-secondary/80 transition-all duration-200 group gap-2"
                  style={{ animationDelay: `${0.5 + index * 0.05}s` }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">Faktura {invoice.invoice_number}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {invoice.client_name} • {new Date(invoice.issue_date).toLocaleDateString('sr-RS')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-sm sm:text-base">{formatCurrency(invoice.total_amount)}</p>
                      <Badge variant={invoice.client_type === 'domestic' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                        {invoice.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 hidden sm:block" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LimitDetailDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        limitType={selectedLimit}
        limits={limits}
        limit6M={LIMIT_6M}
        limit8M={LIMIT_8M}
        invoices={invoices}
        dailySummaries={dailySummaries}
        kpoEntries={kpoEntries}
      />
    </div>
  );
}

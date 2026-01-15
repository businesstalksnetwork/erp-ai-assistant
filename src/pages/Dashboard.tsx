import { useAuth } from '@/lib/auth';
import { useSelectedCompany } from '@/lib/company-context';
import { useLimits } from '@/hooks/useLimits';
import { useReminders } from '@/hooks/useReminders';
import { useInvoices } from '@/hooks/useInvoices';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

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

  const handleToggleReminder = async (id: string, currentStatus: boolean) => {
    try {
      await toggleComplete.mutateAsync({ id, is_completed: currentStatus });
      toast.success('Podsetnik označen kao plaćen');
    } catch (error) {
      toast.error('Greška pri ažuriranju podsetnika');
    }
  };

  const recentInvoices = invoices.filter(i => !i.is_proforma).slice(0, 5);

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
    <div className="space-y-6">
      <div className="animate-fade-in">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Kontrolna tabla</h1>
          <Sparkles className="h-5 w-5 text-primary animate-pulse-slow" />
        </div>
        <p className="text-muted-foreground">
          Pregled za {selectedCompany?.name}
        </p>
      </div>

      {/* Limits Cards */}
      <div className="grid gap-4 md:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* 6M Limit Card */}
        <Card className={cn(
          "card-hover",
          limits.limit6MPercent >= 90 ? 'border-destructive bg-destructive/5' : 
          limits.limit6MPercent >= 75 ? 'border-warning bg-warning/5' : ''
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Godišnji limit (6 miliona)</CardTitle>
              {limits.limit6MPercent >= 90 && (
                <AlertTriangle className="h-5 w-5 text-destructive animate-pulse-slow" />
              )}
            </div>
                <CardDescription>
                  01.01. - 31.12. {new Date().getFullYear()}
                </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Iskorišćeno: {formatCurrency(limits.yearlyTotal)}</span>
                <span className="font-semibold">{limits.limit6MPercent.toFixed(1)}%</span>
              </div>
              <Progress 
                value={limits.limit6MPercent} 
                className={limits.limit6MPercent >= 90 ? '[&>div]:bg-destructive' : limits.limit6MPercent >= 75 ? '[&>div]:bg-warning' : ''}
              />
              <p className="text-sm text-muted-foreground">
                Preostalo: {formatCurrency(limits.limit6MRemaining)} od {formatCurrency(LIMIT_6M)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 8M Limit Card */}
        <Card className={cn(
          "card-hover",
          limits.limit8MPercent >= 90 ? 'border-destructive bg-destructive/5' : 
          limits.limit8MPercent >= 75 ? 'border-warning bg-warning/5' : ''
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Klizni limit (8 miliona)</CardTitle>
              {limits.limit8MPercent >= 90 && (
                <AlertTriangle className="h-5 w-5 text-destructive animate-pulse-slow" />
              )}
            </div>
                <CardDescription>
                  Poslednjih 365 dana
                </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Iskorišćeno: {formatCurrency(limits.rollingDomestic)}</span>
                <span className="font-semibold">{limits.limit8MPercent.toFixed(1)}%</span>
              </div>
              <Progress 
                value={limits.limit8MPercent}
                className={limits.limit8MPercent >= 90 ? '[&>div]:bg-destructive' : limits.limit8MPercent >= 75 ? '[&>div]:bg-warning' : ''}
              />
              <p className="text-sm text-muted-foreground">
                Preostalo: {formatCurrency(limits.limit8MRemaining)} od {formatCurrency(LIMIT_8M)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ukupno faktura</CardTitle>
            <FileText className="h-4 w-4 text-primary group-hover:animate-bounce-subtle" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.filter(i => !i.is_proforma).length}</div>
          </CardContent>
        </Card>

        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Promet u toku godine</CardTitle>
            <TrendingUp className="h-4 w-4 text-success group-hover:animate-bounce-subtle" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(limits.yearlyTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Od 01.01.{new Date().getFullYear()}.
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktivni podsetnici</CardTitle>
            <Bell className="h-4 w-4 text-warning group-hover:animate-bounce-subtle" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingReminders.length}</div>
            <p className="text-xs text-muted-foreground">
              Podsetnici za plaćanje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <Card className="border-warning bg-warning/5 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning animate-bounce-subtle" />
              <CardTitle className="text-lg">
                Podsetnici: {upcomingReminders.length}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingReminders.slice(0, 3).map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-transparent hover:border-primary/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleToggleReminder(reminder.id, reminder.is_completed)}
                      aria-label="Označi kao plaćeno"
                      className="border-warning data-[state=checked]:bg-warning"
                    />
                    <div>
                      <p className="font-medium">{reminder.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Rok: {new Date(reminder.due_date).toLocaleDateString('sr-RS')}
                      </p>
                    </div>
                  </div>
                  {reminder.amount && (
                    <Badge variant="warning">{formatCurrency(reminder.amount)}</Badge>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-3 group" asChild>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Poslednje fakture</CardTitle>
            <CardDescription>Vaše najnovije izdate fakture</CardDescription>
          </div>
          <Button asChild className="group">
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
              Nova faktura
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nemate još izdatih faktura.
            </p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((invoice, index) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-transparent hover:border-primary/20 hover:bg-secondary/80 transition-all duration-200 group"
                  style={{ animationDelay: `${0.5 + index * 0.05}s` }}
                >
                  <div>
                    <p className="font-medium">Faktura {invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.client_name} • {new Date(invoice.issue_date).toLocaleDateString('sr-RS')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(invoice.total_amount)}</p>
                      <Badge variant={invoice.client_type === 'domestic' ? 'default' : 'secondary'}>
                        {invoice.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

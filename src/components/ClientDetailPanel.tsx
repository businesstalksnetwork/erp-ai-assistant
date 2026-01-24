import { useNavigate } from 'react-router-dom';
import { Client } from '@/hooks/useClients';
import { useClientStats } from '@/hooks/useClientStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Pencil, 
  Trash2, 
  TrendingUp, 
  FileText, 
  DollarSign, 
  PieChart,
  Send,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Building2
} from 'lucide-react';

interface ClientDetailPanelProps {
  client: Client;
  companyId: string;
  isSefConfigured: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' RSD';
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sr-Latn-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge variant="default" className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Plaćeno</Badge>;
    case 'partial':
      return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Delimično</Badge>;
    default:
      return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Čeka</Badge>;
  }
}

function getInvoiceTypeBadge(type: string) {
  switch (type) {
    case 'proforma':
      return <Badge variant="outline" className="text-xs">Profaktura</Badge>;
    case 'advance':
      return <Badge variant="secondary" className="text-xs">Avans</Badge>;
    case 'storno':
      return <Badge variant="destructive" className="text-xs">Storno</Badge>;
    default:
      return null;
  }
}

export function ClientDetailPanel({ 
  client, 
  companyId, 
  isSefConfigured, 
  onEdit, 
  onDelete 
}: ClientDetailPanelProps) {
  const navigate = useNavigate();
  const stats = useClientStats(client.id, companyId);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 sm:space-y-4 p-1">
        {/* Client Header Card */}
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base sm:text-xl truncate">{client.name}</CardTitle>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                    {client.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                  </Badge>
                  {isSefConfigured && client.sef_registered && (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] sm:text-xs">
                      <Send className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      SEF
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="outline" onClick={onEdit} className="h-8 w-8 sm:h-9 sm:w-9">
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={onDelete} className="h-8 w-8 sm:h-9 sm:w-9">
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2 sm:space-y-3">
            {(client.address || client.city) && (
              <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
                <span className="truncate">{[client.address, client.city, client.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-2">
              {client.client_type === 'domestic' ? (
                <>
                  {client.pib && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">PIB</p>
                      <p className="font-mono text-xs sm:text-sm font-medium">{client.pib}</p>
                    </div>
                  )}
                  {client.maticni_broj && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Matični broj</p>
                      <p className="font-mono text-xs sm:text-sm font-medium">{client.maticni_broj}</p>
                    </div>
                  )}
                </>
              ) : (
                client.vat_number && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">VAT broj</p>
                    <p className="font-mono text-xs sm:text-sm font-medium">{client.vat_number}</p>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card - compact for mobile */}
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Statistika
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Ukupan promet
                </p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Broj faktura
                </p>
                <p className="text-sm sm:text-lg font-bold">{stats.invoiceCount}</p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <PieChart className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Udeo u prometu
                </p>
                <p className="text-sm sm:text-lg font-bold">{stats.revenueShare.toFixed(1)}%</p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Prosek</p>
                <p className="text-sm sm:text-lg font-bold truncate">
                  {stats.invoiceCount > 0 ? formatCurrency(stats.averageInvoice) : '-'}
                </p>
              </div>
            </div>

            <Separator className="my-2 sm:my-4" />

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-green-500/10">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" />
                  Plaćeno
                </p>
                <p className="text-xs sm:text-sm font-semibold text-green-600 truncate">{formatCurrency(stats.paidAmount)}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-amber-500/10">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-600" />
                  Neplaćeno
                </p>
                <p className="text-xs sm:text-sm font-semibold text-amber-600 truncate">{formatCurrency(stats.unpaidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices Card - compact for mobile */}
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                Poslednje fakture
              </CardTitle>
              {stats.invoiceCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/invoices')}
                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                >
                  Sve
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            {stats.recentInvoices.length === 0 ? (
              <div className="text-center py-4 sm:py-8 text-muted-foreground">
                <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs sm:text-sm">Nema faktura za ovog klijenta</p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {stats.recentInvoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-mono text-xs sm:text-sm font-medium">
                          #{invoice.invoice_number}
                        </span>
                        {getInvoiceTypeBadge(invoice.invoice_type)}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatDate(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="text-right space-y-0.5 flex-shrink-0">
                      <p className="font-medium text-xs sm:text-sm">{formatCurrency(invoice.total_amount)}</p>
                      {getPaymentStatusBadge(invoice.payment_status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

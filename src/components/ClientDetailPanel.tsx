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
      <div className="space-y-6 p-1">
        {/* Client Header Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{client.name}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'}>
                    {client.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                  </Badge>
                  {isSefConfigured && client.sef_registered && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Send className="h-3 w-3 mr-1" />
                      SEF
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(client.address || client.city) && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{[client.address, client.city, client.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              {client.client_type === 'domestic' ? (
                <>
                  {client.pib && (
                    <div>
                      <p className="text-xs text-muted-foreground">PIB</p>
                      <p className="font-mono text-sm font-medium">{client.pib}</p>
                    </div>
                  )}
                  {client.maticni_broj && (
                    <div>
                      <p className="text-xs text-muted-foreground">Matični broj</p>
                      <p className="font-mono text-sm font-medium">{client.maticni_broj}</p>
                    </div>
                  )}
                </>
              ) : (
                client.vat_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">VAT broj</p>
                    <p className="font-mono text-sm font-medium">{client.vat_number}</p>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Statistika
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Ukupan promet
                </p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Broj faktura
                </p>
                <p className="text-lg font-bold">{stats.invoiceCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <PieChart className="h-3 w-3" />
                  Udeo u prometu
                </p>
                <p className="text-lg font-bold">{stats.revenueShare.toFixed(1)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Prosek po fakturi</p>
                <p className="text-lg font-bold">
                  {stats.invoiceCount > 0 ? formatCurrency(stats.averageInvoice) : '-'}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Plaćeno
                </p>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(stats.paidAmount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  Neplaćeno
                </p>
                <p className="text-sm font-semibold text-amber-600">{formatCurrency(stats.unpaidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Poslednje fakture
              </CardTitle>
              {stats.invoiceCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/invoices')}
                >
                  Sve fakture
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nema faktura za ovog klijenta</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentInvoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          #{invoice.invoice_number}
                        </span>
                        {getInvoiceTypeBadge(invoice.invoice_type)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-medium">{formatCurrency(invoice.total_amount)}</p>
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

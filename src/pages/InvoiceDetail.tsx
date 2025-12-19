import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, Building2, Loader2 } from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading } = useInvoices(selectedCompany?.id || null);

  const invoice = invoices.find((i) => i.id === id);

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <h1 className="text-2xl font-bold">Faktura nije pronađena</h1>
        <Button asChild>
          <Link to="/invoices">Nazad na listu</Link>
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Štampaj
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-between">
            <Badge variant={invoice.is_proforma ? 'outline' : 'default'} className="text-lg px-4 py-1">
              {invoice.is_proforma ? 'PREDRAČUN' : 'FAKTURA'}
            </Badge>
            <p className="text-2xl font-mono font-bold">
              {invoice.is_proforma ? 'PR-' : ''}{invoice.invoice_number}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Datum izdavanja</p>
              <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString('sr-RS')}</p>
            </div>
            {invoice.service_date && (
              <div>
                <p className="text-muted-foreground">Datum prometa</p>
                <p className="font-medium">{new Date(invoice.service_date).toLocaleDateString('sr-RS')}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Parties */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Issuer */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">IZDAVALAC</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{selectedCompany.name}</p>
                <p className="text-sm">{selectedCompany.address}</p>
                <p className="text-sm">PIB: {selectedCompany.pib}</p>
                <p className="text-sm">Matični broj: {selectedCompany.maticni_broj}</p>
                {selectedCompany.bank_account && (
                  <p className="text-sm">Račun: {selectedCompany.bank_account}</p>
                )}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">PRIMALAC</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{invoice.client_name}</p>
                {invoice.client_address && <p className="text-sm">{invoice.client_address}</p>}
                {invoice.client_pib && <p className="text-sm">PIB: {invoice.client_pib}</p>}
                <Badge variant={invoice.client_type === 'domestic' ? 'default' : 'secondary'} className="mt-2">
                  {invoice.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">STAVKE</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Opis</th>
                    <th className="text-right p-3 text-sm font-medium w-24">Količina</th>
                    <th className="text-right p-3 text-sm font-medium w-32">Cena</th>
                    <th className="text-right p-3 text-sm font-medium w-36">Ukupno</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3">
                      <p>{invoice.description}</p>
                      <Badge variant="outline" className="mt-1">
                        {invoice.item_type === 'services' ? 'Usluga' : 'Proizvod'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono">{invoice.quantity}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(invoice.unit_price)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatCurrency(invoice.total_amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Foreign Currency */}
          {invoice.foreign_currency && invoice.foreign_amount && (
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Iznos u stranoj valuti</p>
              <p className="font-mono">
                {invoice.foreign_amount} {invoice.foreign_currency}
                {invoice.exchange_rate && (
                  <span className="text-muted-foreground"> (kurs: {invoice.exchange_rate})</span>
                )}
              </p>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground p-4 rounded-lg min-w-[200px]">
              <p className="text-sm opacity-80">ZA PLAĆANJE</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(invoice.total_amount)}</p>
            </div>
          </div>

          <Separator />

          {/* Payment Info */}
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {invoice.payment_deadline && (
              <div>
                <p className="text-muted-foreground">Rok plaćanja</p>
                <p className="font-medium">{new Date(invoice.payment_deadline).toLocaleDateString('sr-RS')}</p>
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <p className="text-muted-foreground">Način plaćanja</p>
                <p className="font-medium">{invoice.payment_method}</p>
              </div>
            )}
          </div>

          {/* Note */}
          {invoice.note && (
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Napomena</p>
              <p className="text-sm">{invoice.note}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

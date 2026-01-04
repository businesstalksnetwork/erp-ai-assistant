import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, Building2, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import pausalBoxLogo from '@/assets/pausal-box-logo.png';

// Helper funkcija za formatiranje broja računa za IPS (tačno 18 cifara)
function formatAccountForIPS(account: string): string {
  const parts = account.replace(/\s/g, '').split('-');
  if (parts.length === 3) {
    // Svaki deo: samo cifre, pa normalizuj na tačnu dužinu
    const bank = parts[0].replace(/\D/g, '').padStart(3, '0').substring(0, 3);
    const middle = parts[1].replace(/\D/g, '').padStart(13, '0').substring(0, 13);
    const control = parts[2].replace(/\D/g, '').padStart(2, '0').substring(0, 2);
    return `${bank}${middle}${control}`;
  }
  // Fallback: samo cifre, dopuni na 18
  return account.replace(/\D/g, '').padStart(18, '0').substring(0, 18);
}

// Funkcija za generisanje IPS QR koda prema NBS standardu
function generateIPSQRCode(params: {
  receiverName: string;
  receiverAccount: string;
  amount: number;
  paymentPurpose: string;
  paymentCode: string;
  paymentModel: string;
  paymentReference: string;
  payerName?: string;
  payerAddress?: string;
}): string {
  const formattedAccount = formatAccountForIPS(params.receiverAccount);
  const amountStr = params.amount.toFixed(2).replace('.', ',');
  
  // Podaci o platiocu - spoji ime i adresu sa CRLF (NBS standard)
  const payerInfo = [params.payerName?.trim(), params.payerAddress?.trim()]
    .filter(Boolean).join('\r\n');
  
  // Svrha plaćanja - ukloni newline karaktere (mora biti jedna linija)
  const cleanPurpose = params.paymentPurpose.replace(/[\r\n]+/g, ' ').substring(0, 35);
  
  // Reference - samo cifre
  const cleanReference = params.paymentReference.replace(/\D/g, '');
  
  // Šifra plaćanja - tačno 3 cifre
  const sf = params.paymentCode.replace(/\D/g, '').padStart(3, '0').substring(0, 3);
  
  // Model - tačno 2 cifre
  const model = params.paymentModel.replace(/\D/g, '').padStart(2, '0').substring(0, 2);
  
  const parts = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${formattedAccount}`,
    `N:${params.receiverName.substring(0, 70)}`,
    `I:RSD${amountStr}`,
    `P:${payerInfo}`,
    `SF:${sf}`,
    `S:${cleanPurpose}`,
  ];
  
  // Dodaj poziv na broj ako je definisan
  if (model && cleanReference) {
    parts.push(`RO:${model}${cleanReference}`);
  }
  
  return parts.join('|');
}

interface InvoiceItem {
  id: string;
  description: string;
  item_type: 'products' | 'services';
  quantity: number;
  unit_price: number;
  total_amount: number;
}

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
  const { invoices, isLoading, getLinkedAdvance } = useInvoices(selectedCompany?.id || null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  

  const invoice = invoices.find((i) => i.id === id);
  const linkedAdvance = invoice ? getLinkedAdvance(invoice.linked_advance_id) : null;
  
  // Calculate amount for payment
  const advanceAmount = linkedAdvance?.total_amount || 0;
  const amountForPayment = invoice ? invoice.total_amount - advanceAmount : 0;

  // Fetch invoice items
  useEffect(() => {
    const fetchItems = async () => {
      if (!id) return;
      
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setItems(data as InvoiceItem[]);
      }
      setLoadingItems(false);
    };

    fetchItems();
  }, [id]);

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
      </div>
    );
  }

  if (isLoading || loadingItems) {
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
    const originalTitle = document.title;
    document.title = ''; // Uklanja naslov iz browser header-a
    window.print();
    document.title = originalTitle;
  };

  // Use items from invoice_items table if available, otherwise fallback to old invoice data
  const displayItems = items.length > 0 ? items : [{
    id: invoice.id,
    description: invoice.description,
    item_type: invoice.item_type as 'products' | 'services',
    quantity: invoice.quantity,
    unit_price: invoice.unit_price,
    total_amount: invoice.total_amount,
  }];

  // Get document title based on type
  const getDocumentTitle = () => {
    if (invoice.invoice_type === 'advance') return 'AVANSNA FAKTURA BROJ';
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') return 'PREDRAČUN BROJ';
    return 'FAKTURA BROJ';
  };

  // Get badge for invoice type
  const getInvoiceTypeBadge = () => {
    if (invoice.invoice_type === 'advance') {
      return (
        <Badge variant={invoice.advance_status === 'closed' ? 'secondary' : 'default'} className="bg-orange-500 text-white">
          {invoice.advance_status === 'closed' ? 'Avans zatvoren' : 'Avansna'}
        </Badge>
      );
    }
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') {
      return <Badge variant="outline">Predračun</Badge>;
    }
    return <Badge variant="default">Faktura</Badge>;
  };

  // Should show QR code - now includes proforma invoices too
  const shouldShowQR = invoice.client_type === 'domestic' && 
    selectedCompany.bank_account && 
    amountForPayment > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto print-invoice">
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
          {/* Logo firme izdavaoca - gore */}
          {(selectedCompany as any).logo_url && (
            <div className="flex justify-center mb-4">
              <img
                src={(selectedCompany as any).logo_url}
                alt={`${selectedCompany.name} logo`}
                className="h-14 max-w-[180px] object-contain"
              />
            </div>
          )}
          {/* Naslov fakture */}
          <h1 className="text-2xl font-bold tracking-tight">
            {getDocumentTitle()}{' '}
            <span className="font-mono">{invoice.invoice_number}</span>
          </h1>
          <div className="mt-2 print:hidden">
            {getInvoiceTypeBadge()}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-6">
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
          <div className="grid grid-cols-2 gap-6">
            {/* Issuer */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">IZDAVALAC</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{selectedCompany.name}</p>
                <p className="text-sm">{selectedCompany.address}</p>
                <p className="text-sm">PIB: {selectedCompany.pib}</p>
                <p className="text-sm">Matični broj: {selectedCompany.maticni_broj}</p>
                {selectedCompany.bank_account && (
                  <p className="text-sm">Bankarski račun: {selectedCompany.bank_account}</p>
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
                {invoice.client_maticni_broj && <p className="text-sm">Matični broj: {invoice.client_maticni_broj}</p>}
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
                  {displayItems.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 1 ? 'bg-muted/50' : ''}>
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
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

          {/* Total with Advance */}
          <div className="flex justify-end">
            <div className="min-w-[250px] space-y-2">
              {linkedAdvance ? (
                <>
                  <div className="flex justify-between text-lg">
                    <span className="text-muted-foreground">UKUPNO:</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Avansno uplaćeno:</span>
                    <span className="font-mono">-{formatCurrency(advanceAmount)}</span>
                  </div>
                  <Separator />
                  <div className="bg-primary text-primary-foreground p-4 rounded-lg">
                    <p className="text-sm opacity-80">ZA PLAĆANJE</p>
                    <p className="text-2xl font-bold font-mono">{formatCurrency(amountForPayment)}</p>
                  </div>
                </>
              ) : (
                <div className="bg-primary text-primary-foreground p-4 rounded-lg">
                  <p className="text-sm opacity-80">ZA PLAĆANJE</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(invoice.total_amount)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Linked Advance Info */}
          {linkedAdvance && (
            <div className="bg-muted p-4 rounded-lg text-sm">
              <p className="font-medium">Povezana avansna faktura:</p>
              <p className="text-muted-foreground">
                {linkedAdvance.invoice_number} od {new Date(linkedAdvance.issue_date).toLocaleDateString('sr-RS')} - {formatCurrency(linkedAdvance.total_amount)}
              </p>
            </div>
          )}

          {/* IPS QR kod - now includes proforma invoices */}
          {shouldShowQR && (
            <div className="border rounded-lg p-4 print:break-inside-avoid">
              <p className="text-sm text-muted-foreground mb-3 text-center font-medium">PODACI ZA UPLATU</p>
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <QRCodeSVG
                    value={generateIPSQRCode({
                      receiverName: selectedCompany.name,
                      receiverAccount: selectedCompany.bank_account,
                      amount: amountForPayment,
                      paymentPurpose: `${invoice.invoice_type === 'advance' ? 'Avansna faktura' : invoice.is_proforma ? 'Predračun' : 'Faktura'} ${invoice.invoice_number}`,
                      paymentCode: '221',
                      paymentModel: '00',
                      paymentReference: invoice.invoice_number,
                      payerName: invoice.client_name,
                      payerAddress: invoice.client_address || '',
                    })}
                    size={120}
                    level="M"
                  />
                </div>
                <div className="text-sm space-y-1 flex-1">
                  <p><span className="text-muted-foreground">Primalac:</span> {selectedCompany.name}</p>
                  <p><span className="text-muted-foreground">Račun:</span> {selectedCompany.bank_account}</p>
                  <p><span className="text-muted-foreground">Iznos:</span> {formatCurrency(amountForPayment)}</p>
                  <p><span className="text-muted-foreground">Svrha:</span> {invoice.invoice_type === 'advance' ? 'Avansna faktura' : invoice.is_proforma ? 'Predračun' : 'Faktura'} {invoice.invoice_number}</p>
                  <p><span className="text-muted-foreground">Poziv na broj:</span> {invoice.invoice_number}</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
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

          {/* Paušal box logo - na dnu */}
          <div className="flex justify-center pt-4">
            <img
              src={pausalBoxLogo}
              alt="Paušal box"
              className="h-12 max-w-[160px] object-contain opacity-70 print:opacity-60"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

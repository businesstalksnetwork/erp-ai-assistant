import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useEmailHistory } from '@/hooks/useInvoiceEmail';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Building2, Loader2, Download, Mail, CheckCircle, Clock } from 'lucide-react';
import { CreateTemplateDialog } from '@/components/CreateTemplateDialog';
import { SendInvoiceDialog } from '@/components/SendInvoiceDialog';
import { QRCodeSVG } from 'qrcode.react';
// Logo removed - using ERP-AI branding
import { generateInvoicePdf } from '@/hooks/usePdfGenerator';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatNumberSr } from '@/lib/utils';
// Helper funkcija za formatiranje broja računa za IPS (tačno 18 UZASTOPNIH cifara BEZ crtica - NBS standard)
function formatAccountForIPS(account: string): string {
  const parts = account.replace(/\s/g, '').split('-');

  if (parts.length === 3) {
    // Svaki deo: samo cifre, pa normalizuj na tačnu dužinu
    const bank = parts[0].replace(/\D/g, '').padStart(3, '0').slice(0, 3);
    // Srednji deo mora imati 13 cifara; dopuna nulama ide unutar srednjeg dela
    const middle = parts[1].replace(/\D/g, '').padStart(13, '0').slice(0, 13);
    const control = parts[2].replace(/\D/g, '').padStart(2, '0').slice(0, 2);

    // NBS IPS zahteva 18 uzastopnih cifara BEZ crtica!
    return `${bank}${middle}${control}`;
  }

  // Fallback: samo cifre, dopuni na 18
  return account.replace(/\D/g, '').padStart(18, '0').slice(0, 18);
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

  // NBS IPS: uklanjamo delimiter "|", "\r", "\n" i kolapsujemo razmake za maksimalnu kompatibilnost
  const sanitize = (value: string) => 
    value.replace(/\|/g, ' ').replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Podaci o platiocu (P) - max 70 karaktera, jedna linija za bolju kompatibilnost sa bankarskim aplikacijama
  const payerName = params.payerName ? sanitize(params.payerName) : '';
  const payerAddressOneLine = params.payerAddress ? sanitize(params.payerAddress) : '';

  let payerInfo = '';
  if (payerName) {
    // Kombinujemo ime i adresu u jednu liniju, max 70 karaktera
    const fullPayer = payerAddressOneLine 
      ? `${payerName} ${payerAddressOneLine}` 
      : payerName;
    payerInfo = fullPayer.substring(0, 70);
  }

  // Svrha plaćanja - jedna linija, max 35, bez "|"
  const cleanPurpose = sanitize(params.paymentPurpose)
    .replace(/[\n]+/g, ' ')
    .substring(0, 35);

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
    `N:${sanitize(params.receiverName).substring(0, 70)}`,
    `I:RSD${amountStr}`,
  ];

  // Po preporukama NBS redosled je: ... I, P, SF, S, RO
  if (payerInfo) {
    parts.push(`P:${payerInfo}`);
  }

  parts.push(`SF:${sf}`);
  parts.push(`S:${cleanPurpose}`);

  // Dodaj poziv na broj ako je definisan
  if (cleanReference) {
    // Model 00 + numerička referenca
    parts.push(`RO:00${cleanReference}`);
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
  foreign_amount?: number;
}

function formatCurrency(amount: number): string {
  return `${formatNumberSr(amount, 2)} RSD`;
}

function formatForeignCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'CHF': 'CHF', 'CAD': 'C$', 'AUD': 'A$',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${formatNumberSr(amount, 2)}`;
}

// Helper za dobijanje prevoda - engleski za strane klijente
const translations: Record<string, { sr: string; en: string }> = {
  invoice_title: { sr: 'FAKTURA BROJ', en: 'INVOICE NO.' },
  proforma_title: { sr: 'PREDRAČUN BROJ', en: 'PROFORMA INVOICE NO.' },
  advance_title: { sr: 'AVANSNA FAKTURA BROJ', en: 'ADVANCE INVOICE NO.' },
  issue_date: { sr: 'Datum izdavanja', en: 'Issue Date' },
  service_date: { sr: 'Datum prometa', en: 'Service Date' },
  place_of_service: { sr: 'Mesto prometa', en: 'Place of Service' },
  issuer: { sr: 'IZDAVALAC', en: 'ISSUER' },
  recipient: { sr: 'PRIMALAC', en: 'RECIPIENT' },
  tax_id: { sr: 'PIB', en: 'Tax ID' },
  reg_no: { sr: 'Matični broj', en: 'Registration No.' },
  bank_account: { sr: 'Bankarski račun', en: 'Bank Account' },
  items: { sr: 'STAVKE', en: 'ITEMS' },
  description: { sr: 'Opis', en: 'Description' },
  quantity: { sr: 'Količina', en: 'Quantity' },
  price: { sr: 'Cena', en: 'Price' },
  total: { sr: 'Ukupno', en: 'Total' },
  exchange_rate: { sr: 'Kurs NBS na dan', en: 'NBS exchange rate on' },
  grand_total: { sr: 'UKUPNO', en: 'TOTAL' },
  advance_paid: { sr: 'Avansno uplaćeno', en: 'Advance paid' },
  amount_due: { sr: 'ZA PLAĆANJE', en: 'AMOUNT DUE' },
  paid: { sr: 'UPLAĆENO', en: 'PAID' },
  linked_advance: { sr: 'Povezana avansna faktura', en: 'Linked advance invoice' },
  payment_due: { sr: 'Rok plaćanja', en: 'Payment Due Date' },
  payment_method: { sr: 'Način plaćanja', en: 'Payment Method' },
  note: { sr: 'Napomena', en: 'Note' },
  domestic: { sr: 'Domaći', en: 'Domestic' },
  foreign: { sr: 'Strani', en: 'Foreign' },
  payment_data: { sr: 'PODACI ZA UPLATU', en: 'PAYMENT DETAILS' },
  receiver: { sr: 'Primalac', en: 'Beneficiary' },
  account: { sr: 'Račun', en: 'Account' },
  amount: { sr: 'Iznos', en: 'Amount' },
  purpose: { sr: 'Svrha', en: 'Purpose' },
  reference: { sr: 'Poziv na broj', en: 'Reference' },
  invoice: { sr: 'Faktura', en: 'Invoice' },
  proforma: { sr: 'Predračun', en: 'Proforma' },
  advance_invoice: { sr: 'Avansna faktura', en: 'Advance invoice' },
  from: { sr: 'od', en: 'from' },
  select_company: { sr: 'Izaberite firmu', en: 'Select a company' },
  invoice_not_found: { sr: 'Faktura nije pronađena', en: 'Invoice not found' },
  back_to_list: { sr: 'Nazad na listu', en: 'Back to list' },
  back: { sr: 'Vrati se nazad', en: 'Back' },
  print: { sr: 'Štampaj', en: 'Print' },
  advance_closed: { sr: 'Avans zatvoren', en: 'Advance closed' },
  advance: { sr: 'Avansna', en: 'Advance' },
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading, getLinkedAdvance } = useInvoices(selectedCompany?.id || null);
  const { clients } = useClients(selectedCompany?.id || null);
  const { data: emailHistory = [] } = useEmailHistory(id);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const isMobileDevice = useIsMobile();

  const invoice = invoices.find((i) => i.id === id);
  const linkedAdvance = invoice ? getLinkedAdvance(invoice.linked_advance_id) : null;
  
  // Get client email if available
  const client = invoice?.client_id ? clients.find(c => c.id === invoice.client_id) : null;
  
  // Calculate amount for payment
  const advanceAmount = linkedAdvance?.total_amount || 0;
  const advanceForeignAmount = linkedAdvance?.foreign_amount || 0;
  const amountForPayment = invoice ? invoice.total_amount - advanceAmount : 0;
  const foreignAmountForPayment = invoice?.foreign_amount ? invoice.foreign_amount - advanceForeignAmount : 0;

  // Translation helper - returns English for foreign clients
  const t = (key: string): string => {
    const isEnglish = invoice?.client_type === 'foreign';
    return translations[key]?.[isEnglish ? 'en' : 'sr'] || key;
  };

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

  // Fetch current user email
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUserEmail();
  }, []);

  // Auto-open send dialog if URL parameter is present
  useEffect(() => {
    if (searchParams.get('openSendDialog') === 'true' && invoice && !isLoading && !loadingItems) {
      setSendDialogOpen(true);
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, invoice, isLoading, loadingItems]);

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{translations.select_company.sr}</h1>
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
        <h1 className="text-2xl font-bold">{translations.invoice_not_found.sr}</h1>
        <Button asChild>
          <Link to="/invoices">{translations.back_to_list.sr}</Link>
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    // Najpouzdanije rešenje za Safari/macOS “praznu drugu stranu”:
    // štampaj iz izolovanog prozora koji sadrži SAMO fakturu.
    const invoiceElement = document.querySelector('.print-invoice') as HTMLElement | null;
    if (!invoiceElement) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // fallback (npr. ako je pop-up blokiran)
      window.print();
      return;
    }

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => (el as HTMLElement).outerHTML)
      .join('\n');

    // Kloniraj i ukloni elemente koji su UI-only
    const clone = invoiceElement.cloneNode(true) as HTMLElement;
    clone.classList.remove('animate-fade-in');
    clone.querySelectorAll('.print\\:hidden').forEach((el) => el.remove());

    // Ime dokumenta (bez "/")
    const docType = invoice.invoice_type === 'proforma' || invoice.is_proforma
      ? 'Predracun'
      : invoice.invoice_type === 'advance'
        ? 'Avans'
        : 'Faktura';
    const safeNumber = invoice.invoice_number.replace(/\//g, '-');
    const title = `${docType} ${safeNumber}`;

    const html = `
      <!DOCTYPE html>
      <html lang="sr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title}</title>
          ${styles}
          <style>
            /* Safari/macOS: izbegni bug sa praznom drugom stranom */
            @page { size: A4; margin: 0mm; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
            }
            .print-invoice {
              position: static !important;
              top: auto !important;
              left: auto !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: none !important;
              padding: 3mm !important;
            }
            .print-invoice, .print-invoice * {
              transform: none !important;
              filter: none !important;
              animation: none !important;
              transition: none !important;
            }
          </style>
        </head>
        <body>
          ${clone.outerHTML}
          <script>
            window.onload = function () {
              // Kratka pauza da se CSS definitivno primeni
              setTimeout(function () {
                window.focus();
                window.print();
                // Zatvori prozor nakon starta print-a
                setTimeout(function(){ window.close(); }, 50);
              }, 200);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };


  const handleDownloadPDF = async () => {
    if (!invoice) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const invoiceType = invoice.invoice_type === 'advance' 
        ? 'advance' 
        : (invoice.is_proforma || invoice.invoice_type === 'proforma')
          ? 'proforma'
          : 'regular';
      
      await generateInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        invoiceType,
        returnBlob: false,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
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
  const isStorno = invoice.total_amount < 0;
  const getDocumentTitle = () => {
    if (invoice.invoice_type === 'advance') return t('advance_title');
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') return t('proforma_title');
    if (isStorno) {
      return invoice.client_type === 'foreign' ? 'CREDIT NOTE NO.' : 'STORNO FAKTURA BROJ';
    }
    return t('invoice_title');
  };

  // Get badge for invoice type
  const getInvoiceTypeBadge = () => {
    if (invoice.invoice_type === 'advance') {
      return (
        <Badge variant={invoice.advance_status === 'closed' ? 'secondary' : 'default'} className="bg-orange-500 text-white">
          {invoice.advance_status === 'closed' ? t('advance_closed') : t('advance')}
        </Badge>
      );
    }
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') {
      return <Badge variant="outline">{t('proforma')}</Badge>;
    }
    return <Badge variant="default">{t('invoice')}</Badge>;
  };

  // Should show QR code - now includes proforma invoices too
  const shouldShowQR = invoice.client_type === 'domestic' && 
    selectedCompany.bank_account && 
    amountForPayment > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto print-invoice print:m-0 print:max-w-none print:w-full print:space-y-2 print:h-auto print:min-h-0 print:overflow-visible">
      <div className="print:hidden space-y-3">
        <Button variant="ghost" onClick={() => navigate('/invoices')} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vrati se nazad
        </Button>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleDownloadPDF} 
            className="w-full sm:w-auto"
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGeneratingPDF ? 'Generisanje...' : 'Preuzmi PDF'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setSendDialogOpen(true)} 
            className="w-full sm:w-auto"
          >
            <Mail className="mr-2 h-4 w-4" />
            Pošalji klijentu
            {emailHistory.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-700 border-green-300">
                {emailHistory.length}
              </Badge>
            )}
          </Button>
          <CreateTemplateDialog 
            invoice={{
              id: invoice.id,
              invoice_type: (invoice.invoice_type || (invoice.is_proforma ? 'proforma' : 'regular')) as 'regular' | 'proforma' | 'advance',
              client_id: invoice.client_id,
              client_name: invoice.client_name,
              client_address: invoice.client_address,
              client_pib: invoice.client_pib,
              client_maticni_broj: invoice.client_maticni_broj,
              client_type: invoice.client_type as 'domestic' | 'foreign',
              foreign_currency: invoice.foreign_currency,
              payment_method: invoice.payment_method,
              note: invoice.note,
            }} 
            items={displayItems} 
            companyId={selectedCompany.id} 
          />
        </div>
      </div>

      {/* Email History Section */}
      {emailHistory.length > 0 && (
        <Card className="print:hidden">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4" />
              Istorija slanja ({emailHistory.length})
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="space-y-2">
              {emailHistory.slice(0, 3).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm">
                    {log.status === 'sent' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground text-xs sm:text-sm">
                      {new Date(log.sent_at).toLocaleDateString('sr-RS', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="truncate max-w-[140px] sm:max-w-[200px] text-xs sm:text-sm">{log.sent_to}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.language === 'en' ? '🇬🇧 EN' : '🇷🇸 SR'}
                    </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="print:shadow-none print:border-0 print:h-auto print:min-h-0 print:overflow-visible">
        <CardHeader className="text-center border-b print:flex print:flex-row print:items-center print:justify-between print:text-left print:py-2">
          {/* Logo firme izdavaoca - gore */}
          {(selectedCompany as any).logo_url && (
            <div className="flex justify-center mb-4 print:mb-0 print:justify-start">
              <img
                src={(selectedCompany as any).logo_url}
                alt={`${selectedCompany.name} logo`}
                className="h-14 max-w-[180px] object-contain print:h-12 print:max-w-[150px]"
              />
            </div>
          )}
          {/* Naslov fakture */}
          <h1 className="text-2xl font-bold tracking-tight print:text-sm print:m-0">
            {getDocumentTitle()}{' '}
            <span className="font-mono">{invoice.invoice_number}</span>
          </h1>
          <div className="mt-2 print:hidden">
            {getInvoiceTypeBadge()}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-6">
          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('issue_date')}</p>
              <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString('sr-RS')}</p>
            </div>
            {invoice.service_date && (
              <div>
                <p className="text-muted-foreground">{t('service_date')}</p>
                <p className="font-medium">{new Date(invoice.service_date).toLocaleDateString('sr-RS')}</p>
              </div>
            )}
            {invoice.place_of_service && (
              <div>
                <p className="text-muted-foreground">{t('place_of_service')}</p>
                <p className="font-medium">{invoice.place_of_service}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Issuer */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('issuer')}</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{selectedCompany.name}</p>
                <p className="text-sm">{selectedCompany.address}</p>
                {(selectedCompany.city || selectedCompany.country) && (
                  <p className="text-sm">
                    {[selectedCompany.city, selectedCompany.country].filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-sm">{t('tax_id')}: {selectedCompany.pib}</p>
                <p className="text-sm">{t('reg_no')}: {selectedCompany.maticni_broj}</p>
                {selectedCompany.bank_account && invoice.client_type === 'domestic' && (
                  <p className="text-sm">{t('bank_account')}: {selectedCompany.bank_account}</p>
                )}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('recipient')}</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{invoice.client_name}</p>
                {invoice.client_address && <p className="text-sm">{invoice.client_address}</p>}
                {(invoice.client_city || invoice.client_country) && (
                  <p className="text-sm">
                    {[invoice.client_city, invoice.client_country].filter(Boolean).join(', ')}
                  </p>
                )}
                {invoice.client_type === 'domestic' ? (
                  <>
                    {invoice.client_pib && <p className="text-sm">{t('tax_id')}: {invoice.client_pib}</p>}
                    {invoice.client_maticni_broj && <p className="text-sm">{t('reg_no')}: {invoice.client_maticni_broj}</p>}
                  </>
                ) : (
                  (invoice as any).client_vat_number && <p className="text-sm">VAT: {(invoice as any).client_vat_number}</p>
                )}
                <Badge variant={invoice.client_type === 'domestic' ? 'default' : 'secondary'} className="mt-2 print:hidden">
                  {invoice.client_type === 'domestic' ? t('domestic') : t('foreign')}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">{t('items')}</p>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left p-2 sm:p-3 text-sm font-medium">{t('description')}</th>
                    <th className="text-right p-2 sm:p-3 text-sm font-medium w-16 sm:w-24">{t('quantity')}</th>
                    <th className="text-right p-2 sm:p-3 text-sm font-medium w-24 sm:w-32">{t('price')}</th>
                    <th className="text-right p-2 sm:p-3 text-sm font-medium w-28 sm:w-36">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 1 ? 'bg-muted/50' : ''}>
                      <td className="p-2 sm:p-3">{item.description}</td>
                      <td className="p-2 sm:p-3 text-right font-mono">{item.quantity}</td>
                      <td className="p-2 sm:p-3 text-right font-mono">
                        {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.exchange_rate ? (
                          formatForeignCurrency(item.unit_price / invoice.exchange_rate, invoice.foreign_currency)
                        ) : (
                          formatCurrency(item.unit_price)
                        )}
                      </td>
                      <td className="p-2 sm:p-3 text-right font-mono font-semibold">
                        {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.exchange_rate ? (
                          formatForeignCurrency(item.total_amount / invoice.exchange_rate, invoice.foreign_currency)
                        ) : (
                          formatCurrency(item.total_amount)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Foreign Currency Info */}
          {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.exchange_rate && (
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">{t('exchange_rate')} {new Date(invoice.issue_date).toLocaleDateString('sr-RS')}</p>
              <p className="font-mono">
                1 {invoice.foreign_currency} = {invoice.exchange_rate} RSD
              </p>
            </div>
          )}

          {/* Total with Advance */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            {/* IPS QR kod - now includes proforma invoices */}
            {shouldShowQR && (() => {
              const cleanReference = invoice.invoice_number.replace(/\D/g, '');
              const ipsString = generateIPSQRCode({
                receiverName: selectedCompany.name,
                receiverAccount: selectedCompany.bank_account,
                amount: amountForPayment,
                paymentPurpose: `${invoice.invoice_type === 'advance' ? 'Avansna faktura' : invoice.is_proforma ? 'Predračun' : 'Faktura'} ${invoice.invoice_number}`,
                paymentCode: '221',
                paymentModel: '00',
                paymentReference: invoice.invoice_number,
                payerName: invoice.client_name,
                payerAddress: invoice.client_address || '',
              });
              
              return (
                <div className="border rounded-lg p-3 print:break-inside-avoid flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <QRCodeSVG
                      value={ipsString}
                      size={80}
                      level="L"
                      includeMargin={false}
                    />
                    <p className="text-sm text-muted-foreground">Plati pomoću<br />QR koda.</p>
                  </div>
                  {/* Debug: prikaži IPS string - samo za development */}
                  <details className="mt-2 print:hidden">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Debug QR</summary>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded whitespace-pre-wrap break-all">{ipsString}</pre>
                  </details>
                </div>
              );
            })()}
            
            <div className="w-full sm:min-w-[280px] sm:w-auto space-y-2">
              {linkedAdvance ? (
                <>
                  <div className="flex justify-between text-lg">
                    <span className="text-muted-foreground">{t('grand_total')}:</span>
                    <div className="text-right">
                      {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.foreign_amount ? (
                        <>
                          <span className="font-mono font-semibold">
                            {formatForeignCurrency(invoice.foreign_amount, invoice.foreign_currency)}
                          </span>
                          <div className="text-sm text-muted-foreground font-mono">
                            {formatCurrency(invoice.total_amount)}
                          </div>
                        </>
                      ) : (
                        <span className="font-mono font-semibold">{formatCurrency(invoice.total_amount)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>{t('advance_paid')}:</span>
                    <div className="text-right font-mono">
                      {invoice.client_type === 'foreign' && invoice.foreign_currency && linkedAdvance.foreign_amount ? (
                        <>
                          <span>-{formatForeignCurrency(linkedAdvance.foreign_amount, invoice.foreign_currency)}</span>
                          <div className="text-sm">-{formatCurrency(advanceAmount)}</div>
                        </>
                      ) : (
                        <span>-{formatCurrency(advanceAmount)}</span>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="bg-slate-800 text-white px-6 py-4 rounded-lg w-full">
                    <p className="text-sm text-slate-300">{t('amount_due')}</p>
                    {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.foreign_amount && invoice.exchange_rate ? (
                      <>
                        <p className="text-2xl font-bold font-mono text-white">
                          {formatForeignCurrency(foreignAmountForPayment, invoice.foreign_currency)}
                        </p>
                        <p className="text-lg font-mono text-slate-200">
                          {formatCurrency(foreignAmountForPayment * invoice.exchange_rate)}
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold font-mono text-white">{formatCurrency(amountForPayment)}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-slate-800 text-white px-6 py-4 rounded-lg w-full">
                  <p className="text-sm text-slate-300">
                    {invoice.invoice_type === 'advance' ? t('paid') : t('amount_due')}
                  </p>
                  {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.foreign_amount ? (
                    <>
                      <p className="text-2xl font-bold font-mono text-white">
                        {formatForeignCurrency(invoice.foreign_amount, invoice.foreign_currency)}
                      </p>
                      <p className="text-lg font-mono text-slate-200">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold font-mono text-white">{formatCurrency(invoice.total_amount)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Linked Advance Info */}
          {linkedAdvance && (
            <div className="bg-muted p-4 rounded-lg text-sm">
              <p className="font-medium">{t('linked_advance')}:</p>
              <p className="text-muted-foreground">
                {linkedAdvance.invoice_number} {t('from')} {new Date(linkedAdvance.issue_date).toLocaleDateString('sr-RS')} - {formatCurrency(linkedAdvance.total_amount)}
              </p>
            </div>
          )}


          <Separator />

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {invoice.payment_deadline && (
              <div>
                <p className="text-muted-foreground">{t('payment_due')}</p>
                <p className="font-medium">{new Date(invoice.payment_deadline).toLocaleDateString('sr-RS')}</p>
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <p className="text-muted-foreground">{t('payment_method')}</p>
                <p className="font-medium">{invoice.payment_method}</p>
              </div>
            )}
          </div>

          {/* Note */}
          {invoice.note && (
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">{t('note')}</p>
              <p className="text-sm whitespace-pre-line">{invoice.note}</p>
            </div>
          )}

          {/* Potpisi - fakturisao / M.P. / primio */}
          <div className="flex items-end justify-between pt-14 print:pt-8">
            <div className="flex flex-col items-center w-32">
              <div className="w-full border-t border-foreground" />
              <span className="text-xs text-muted-foreground mt-1">(fakturisao)</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold">M.P.</span>
            </div>
            <div className="flex flex-col items-center w-32">
              <div className="w-full border-t border-foreground" />
              <span className="text-xs text-muted-foreground mt-1">(primio)</span>
            </div>
          </div>

          {/* ERP-AI branding - na dnu */}
          <div className="flex justify-center pt-4 print:pt-2">
            <div className="text-xs text-muted-foreground font-medium">
              ERP-AI Assistant
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Invoice Dialog */}
      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        clientEmail={client?.email}
        clientType={invoice.client_type as 'domestic' | 'foreign'}
        totalAmount={invoice.foreign_amount && invoice.foreign_currency 
          ? formatForeignCurrency(invoice.foreign_amount, invoice.foreign_currency)
          : formatCurrency(invoice.total_amount)}
        issueDate={new Date(invoice.issue_date).toLocaleDateString('sr-RS')}
        paymentDeadline={invoice.payment_deadline ? new Date(invoice.payment_deadline).toLocaleDateString('sr-RS') : undefined}
        generatePdfBlob={async () => {
          const invoiceType = invoice.invoice_type === 'advance' 
            ? 'advance' 
            : (invoice.is_proforma || invoice.invoice_type === 'proforma')
              ? 'proforma'
              : 'regular';
          
          const blob = await generateInvoicePdf({
            invoiceNumber: invoice.invoice_number,
            invoiceType,
            returnBlob: true,
          });
          
          if (!blob) {
            throw new Error('Failed to generate PDF blob');
          }
          
          return blob;
        }}
        userEmail={userEmail}
        signatureSr={selectedCompany.email_signature_sr}
        signatureEn={selectedCompany.email_signature_en}
      />
    </div>
  );
}

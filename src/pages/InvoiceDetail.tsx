import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, Building2, Loader2, Download } from 'lucide-react';
import { CreateTemplateDialog } from '@/components/CreateTemplateDialog';
import { QRCodeSVG } from 'qrcode.react';
import pausalBoxLogo from '@/assets/pausal-box-logo.png';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  foreign_amount?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatForeignCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading, getLinkedAdvance } = useInvoices(selectedCompany?.id || null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  

  const invoice = invoices.find((i) => i.id === id);
  const linkedAdvance = invoice ? getLinkedAdvance(invoice.linked_advance_id) : null;
  
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
    const originalTitle = document.title;
    document.title = ''; // Uklanja naslov iz browser header-a
    window.print();
    document.title = originalTitle;
  };


  const handleDownloadPDF = async () => {
    const invoiceElement = document.querySelector('.print-invoice') as HTMLElement;
    if (!invoiceElement) return;

    setIsGeneratingPDF(true);

    // Kreiraj offscreen wrapper sa fiksnom A4 širinom
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = '794px'; // A4 širina na 96dpi
    wrapper.style.background = 'white';
    wrapper.className = 'pdf-export';

    // Kloniraj sadržaj fakture
    const clone = invoiceElement.cloneNode(true) as HTMLElement;
    
    // Sakrij print:hidden elemente u klonu
    clone.querySelectorAll('.print\\:hidden').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    // FORSIRATI TAMNIJI TEKST INLINE (mobilni uređaji ponekad renderuju bledo kroz html2canvas)
    const solidText = 'hsl(0 0% 0%)';
    const mutedText = 'hsl(0 0% 20%)';

    clone.style.backgroundColor = 'hsl(0 0% 100%)';
    clone.style.color = solidText;

    clone.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement;

      // Ukloni sve što može da "izbleđuje" prikaz
      element.style.opacity = '1';
      element.style.filter = 'none';
      element.style.textShadow = 'none';
      (element.style as any).webkitFontSmoothing = 'auto';

      // Default: crn tekst
      element.style.color = solidText;
      element.style.webkitTextFillColor = solidText;

      // Muted varijante: tamno siva
      if (
        element.classList.contains('text-muted-foreground') ||
        element.classList.contains('text-gray-500') ||
        element.classList.contains('text-gray-600') ||
        element.classList.contains('text-gray-700')
      ) {
        element.style.color = mutedText;
        element.style.webkitTextFillColor = mutedText;
      }
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      // Čekaj fontove i stabilizaciju
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 200));

      const boostCanvasContrast = (targetCanvas: HTMLCanvasElement) => {
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = targetCanvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Pojačaj kontrast i blago smanji osvetljenje da tekst bude "puniji" (posebno na telefonu)
        const contrast = 1.4;
        const brightness = 0.93;

        const clamp = (v: number) => Math.max(0, Math.min(255, v));

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a === 0) continue;

          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Održavaj čistu belu pozadinu
          if (r > 245 && g > 245 && b > 245) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            continue;
          }

          r = ((r - 128) * contrast + 128) * brightness;
          g = ((g - 128) * contrast + 128) * brightness;
          b = ((b - 128) * contrast + 128) * brightness;

          data[i] = clamp(r);
          data[i + 1] = clamp(g);
          data[i + 2] = clamp(b);
        }

        ctx.putImageData(imageData, 0, 0);
      };

      // Renderuj offscreen wrapper
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: 'hsl(0 0% 100%)',
        logging: false,
      });

      boostCanvasContrast(canvas);


      // Kreiraj PDF - FIT TO PAGE (jedna strana)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Ako je previsoko, skaliraj da stane na jednu stranu
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > pdfHeight) {
        const scale = pdfHeight / imgHeight;
        finalWidth = imgWidth * scale;
        finalHeight = pdfHeight;
      }

      // Centriraj horizontalno
      const xOffset = (pdfWidth - finalWidth) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, 0, finalWidth, finalHeight);

      // Ime fajla bazirano na broju fakture
      const docType = invoice.invoice_type === 'proforma' || invoice.is_proforma 
        ? 'Predracun' 
        : invoice.invoice_type === 'advance' 
          ? 'Avans' 
          : 'Faktura';
      const fileName = `${docType}_${invoice.invoice_number.replace(/\//g, '-')}.pdf`;
      
      pdf.save(fileName);
    } finally {
      // Ukloni offscreen wrapper
      document.body.removeChild(wrapper);
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
  const getDocumentTitle = () => {
    if (invoice.invoice_type === 'advance') return t('advance_title');
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') return t('proforma_title');
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto print-invoice">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('back')}
        </Button>
        <div className="flex gap-2 flex-wrap">
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
          <Button 
            onClick={handleDownloadPDF} 
            className="flex-1 sm:flex-none"
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGeneratingPDF ? 'Generisanje...' : 'Sačuvaj PDF'}
          </Button>
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="mr-2 h-4 w-4" />
            {t('print')}
          </Button>
        </div>
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
          <div className="grid grid-cols-2 gap-6">
            {/* Issuer */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('issuer')}</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{selectedCompany.name}</p>
                <p className="text-sm">{selectedCompany.address}</p>
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
                {invoice.client_pib && <p className="text-sm">{t('tax_id')}: {invoice.client_pib}</p>}
                {invoice.client_maticni_broj && <p className="text-sm">{t('reg_no')}: {invoice.client_maticni_broj}</p>}
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">{t('description')}</th>
                    <th className="text-right p-3 text-sm font-medium w-24">{t('quantity')}</th>
                    <th className="text-right p-3 text-sm font-medium w-32">{t('price')}</th>
                    <th className="text-right p-3 text-sm font-medium w-36">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 1 ? 'bg-muted/50' : ''}>
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">
                        {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.exchange_rate ? (
                          formatForeignCurrency(item.unit_price / invoice.exchange_rate, invoice.foreign_currency)
                        ) : (
                          formatCurrency(item.unit_price)
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
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
          <div className="flex justify-end">
            <div className="min-w-[280px] space-y-2">
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
                  <div className="bg-primary text-primary-foreground p-4 rounded-lg">
                    <p className="text-sm opacity-80">{t('amount_due')}</p>
                    {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.foreign_amount && invoice.exchange_rate ? (
                      <>
                        <p className="text-2xl font-bold font-mono">
                          {formatForeignCurrency(foreignAmountForPayment, invoice.foreign_currency)}
                        </p>
                        <p className="text-lg font-mono opacity-90">
                          {formatCurrency(foreignAmountForPayment * invoice.exchange_rate)}
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold font-mono">{formatCurrency(amountForPayment)}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-primary text-primary-foreground p-4 rounded-lg">
                  <p className="text-sm opacity-80">
                    {invoice.invoice_type === 'advance' ? t('paid') : t('amount_due')}
                  </p>
                  {invoice.client_type === 'foreign' && invoice.foreign_currency && invoice.foreign_amount ? (
                    <>
                      <p className="text-2xl font-bold font-mono">
                        {formatForeignCurrency(invoice.foreign_amount, invoice.foreign_currency)}
                      </p>
                      <p className="text-lg font-mono opacity-90">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold font-mono">{formatCurrency(invoice.total_amount)}</p>
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

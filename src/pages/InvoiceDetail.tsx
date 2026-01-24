import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useEmailHistory } from '@/hooks/useInvoiceEmail';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, Building2, Loader2, Download, Mail, CheckCircle, Clock } from 'lucide-react';
import { CreateTemplateDialog } from '@/components/CreateTemplateDialog';
import { SendInvoiceDialog } from '@/components/SendInvoiceDialog';
import { QRCodeSVG } from 'qrcode.react';
import pausalBoxLogo from '@/assets/pausal-box-logo-light.png';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useIsMobile } from '@/hooks/use-mobile';

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
    const invoiceElement = document.querySelector('.print-invoice') as HTMLElement;
    if (!invoiceElement) return;

    setIsGeneratingPDF(true);

    // Detekcija mobilnog uređaja
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

    // Kreiraj offscreen wrapper sa fiksnom A4 širinom i auto visinom
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = '794px'; // A4 širina na 96dpi
    wrapper.style.minHeight = '1123px'; // A4 visina na 96dpi
    wrapper.style.height = 'auto';
    wrapper.style.overflow = 'visible';
    wrapper.style.background = 'white';
    wrapper.style.padding = '16px 16px 20px 16px'; // Kompaktnije margine za jednu stranu
    wrapper.className = 'pdf-export';

    // Kloniraj sadržaj fakture
    const clone = invoiceElement.cloneNode(true) as HTMLElement;
    
    // Osiguraj da clone ima sve potrebne stilove za pun prikaz
    clone.style.width = '100%';
    clone.style.height = 'auto';
    clone.style.minHeight = 'auto';
    clone.style.overflow = 'visible';
    clone.style.position = 'relative';
    clone.style.paddingBottom = '24px'; // Dodatni prostor na dnu
    
    // KRITIČNO: Sprečiti page-break unutar klona
    clone.style.breakInside = 'avoid';
    clone.style.pageBreakInside = 'avoid';
    
    // Pronađi Card komponentu i forsiraj break-inside: avoid
    const cardElement = clone.querySelector('.rounded-lg');
    if (cardElement) {
      (cardElement as HTMLElement).style.breakInside = 'avoid';
      (cardElement as HTMLElement).style.pageBreakInside = 'avoid';
      
      // Osiguraj da se header ne odvaja od content-a
      const header = cardElement.querySelector('[class*="border-b"]');
      if (header) {
        (header as HTMLElement).style.breakAfter = 'avoid';
        (header as HTMLElement).style.pageBreakAfter = 'avoid';
      }
    }
    
    // Sakrij print:hidden elemente u klonu
    clone.querySelectorAll('.print\\:hidden').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    // FORSIRATI MAKSIMALAN KONTRAST - čisto crna na beloj
    // Na mobilnom: sve boje su čisto crne za maksimalnu čitljivost
    const solidText = '#000000';
    const mutedText = isMobile ? '#000000' : '#222222';
    clone.style.backgroundColor = '#ffffff';
    clone.style.background = '#ffffff';
    clone.style.color = solidText;

    clone.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement;
      const computedStyle = window.getComputedStyle(element);

      // Ukloni sve što može da "izbleđuje" prikaz
      element.style.opacity = '1';
      element.style.filter = 'none';
      element.style.textShadow = 'none';
      (element.style as any).webkitFontSmoothing = 'antialiased';

      // Ako element ima border, učini ga tamnijim
      if (computedStyle.borderWidth !== '0px' && computedStyle.borderStyle !== 'none') {
        element.style.borderColor = '#888888';
      }

      // Default: čisto crn tekst
      element.style.color = solidText;
      element.style.webkitTextFillColor = solidText;

      // Muted varijante: tamno siva (ali i dalje čitljiva)
      if (
        element.classList.contains('text-muted-foreground') ||
        element.classList.contains('text-gray-500') ||
        element.classList.contains('text-gray-600') ||
        element.classList.contains('text-gray-700')
      ) {
        element.style.color = mutedText;
        element.style.webkitTextFillColor = mutedText;
      }

      // Bela pozadina za sve kartiice i kontejnere
      if (computedStyle.backgroundColor !== 'transparent' && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // Zadržaj samo bele/svetle pozadine
        const bg = computedStyle.backgroundColor;
        if (!bg.includes('255, 255, 255') && !bg.includes('rgb(255') && !element.classList.contains('bg-primary')) {
          element.style.backgroundColor = '#ffffff';
        }
      }
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Sačekaj da se sve slike učitaju pre renderovanja
    const images = Array.from(wrapper.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = () => resolve(null);
        img.onerror = () => resolve(null);
      });
    }));

    try {
      // Čekaj fontove i stabilizaciju
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Izmeri stvarnu visinu sadržaja nakon renderovanja
      const actualHeight = wrapper.scrollHeight;
      wrapper.style.height = actualHeight + 'px';

      // Pojačaj kontrast na canvas-u - ULTRA AGRESIVNO za mobilni
      const boostCanvasContrast = (targetCanvas: HTMLCanvasElement) => {
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = targetCanvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // ULTRA agresivan prag - SVE što nije skoro potpuno belo postaje crno
        // Ovo osigurava da čak i svetlo sivi tekst postane čisto crn
        const blackThreshold = isMobile ? 245 : 240;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a === 0) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Izračunaj luminance (percepcijski ponderisana svetlina)
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

          // Na mobilnom: STROGA binarizacija - crno ili belo, bez sive
          if (isMobile) {
            if (luminance >= blackThreshold) {
              // Samo skoro-beli pikseli ostaju beli
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            } else {
              // SVE OSTALO postaje ČISTO CRNO - uključujući svetlo sivi tekst
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            }
          } else {
            // Desktop: blaža binarizacija
            if (luminance >= blackThreshold) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            } else if (luminance < 200) {
              // Tamniji pikseli postaju crni
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            } else {
              // Srednja zona - pojačaj kontrast
              const factor = 2.5;
              data[i] = Math.max(0, Math.min(255, (r - 128) * factor + 128));
              data[i + 1] = Math.max(0, Math.min(255, (g - 128) * factor + 128));
              data[i + 2] = Math.max(0, Math.min(255, (b - 128) * factor + 128));
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
      };

      // Na mobilnom koristi manji scale (1.5) da smanji memoriju
      // Na desktopu koristi scale 2 za bolju rezoluciju
      const canvasScale = isMobile ? 1.5 : 2;

      // Renderuj offscreen wrapper sa dinamičkom visinom
      const canvas = await html2canvas(wrapper, {
        scale: canvasScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
        windowHeight: actualHeight,
        height: actualHeight,
        scrollX: 0,
        scrollY: 0,
      });

      boostCanvasContrast(canvas);

      // Kreiraj PDF - FIT TO PAGE (jedna strana) sa marginama
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Margine za sigurnost - povećane da se ništa ne seče
      const margin = 5; // 5mm margina
      const usableWidth = pdfWidth - (margin * 2);
      const usableHeight = pdfHeight - (margin * 2);
      
      let finalWidth = usableWidth;
      let finalHeight = (canvas.height * usableWidth) / canvas.width;

      // Ako je previsoko, skaliraj da stane na jednu stranu sa dodatnim sigurnosnim faktorom
      if (finalHeight > usableHeight) {
        const scale = (usableHeight / finalHeight) * 0.98; // 2% sigurnosni faktor
        finalWidth = usableWidth * scale;
        finalHeight = usableHeight * 0.98;
      }

      // Centriraj horizontalno i vertikalno
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      // Na mobilnom koristi JPEG (manja memorija), na desktopu PNG (bolja kvaliteta)
      const imageFormat = isMobile ? 'JPEG' : 'PNG';
      const imageData = isMobile 
        ? canvas.toDataURL('image/jpeg', 0.92) 
        : canvas.toDataURL('image/png');
      
      pdf.addImage(imageData, imageFormat, xOffset, yOffset, finalWidth, finalHeight);

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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto print-invoice print:m-0 print:max-w-none print:w-full print:space-y-2 print:h-auto print:min-h-0 print:overflow-visible">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vrati se nazad
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
          {isMobileDevice && (
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
          )}
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="mr-2 h-4 w-4" />
            {isMobileDevice ? 'Štampaj' : 'Preuzmi'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setSendDialogOpen(true)} 
            className="flex-1 sm:flex-none"
          >
            <Mail className="mr-2 h-4 w-4" />
            Pošalji klijentu
            {emailHistory.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-700 border-green-300">
                {emailHistory.length}
              </Badge>
            )}
          </Button>
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
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {log.status === 'sent' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <span className="text-muted-foreground">
                      {new Date(log.sent_at).toLocaleDateString('sr-RS', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="truncate max-w-[200px]">{log.sent_to}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.language === 'en' ? '🇬🇧 EN' : '🇷🇸 SR'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="print:shadow-none print:border-0 print:h-auto print:min-h-0 print:overflow-visible">
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
              <div className="border rounded-lg p-4 print:break-inside-avoid">
                <p className="text-sm text-muted-foreground mb-3 text-center font-medium">PODACI ZA UPLATU</p>
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <QRCodeSVG
                      value={ipsString}
                      size={160}
                      level="L"
                      includeMargin
                    />
                  </div>
                  <div className="text-sm space-y-1 flex-1">
                    <p><span className="text-muted-foreground">Primalac:</span> {selectedCompany.name}</p>
                    <p><span className="text-muted-foreground">Račun:</span> {selectedCompany.bank_account}</p>
                    <p><span className="text-muted-foreground">Iznos:</span> {formatCurrency(amountForPayment)}</p>
                    <p><span className="text-muted-foreground">Svrha:</span> {invoice.invoice_type === 'advance' ? 'Avansna faktura' : invoice.is_proforma ? 'Predračun' : 'Faktura'} {invoice.invoice_number}</p>
                    <p><span className="text-muted-foreground">Model:</span> 00</p>
                    <p><span className="text-muted-foreground">Poziv na broj:</span> {cleanReference}</p>
                  </div>
                </div>
                {/* Debug: prikaži IPS string */}
                <details className="mt-3 print:hidden">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Debug QR</summary>
                  <pre className="mt-1 text-xs bg-muted p-2 rounded whitespace-pre-wrap break-all">{ipsString}</pre>
                </details>
              </div>
            );
          })()}

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
          <div className="flex justify-center pt-6 print:pt-4">
            <img
              src={pausalBoxLogo}
              alt="Paušal box"
              className="h-8 max-w-[120px] object-contain opacity-70 print:opacity-60 print:h-6"
            />
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
          // Reuse the existing PDF generation logic
          const invoiceElement = document.querySelector('.print-invoice') as HTMLElement;
          if (!invoiceElement) throw new Error('Invoice element not found');
          
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;min-height:1123px;height:auto;overflow:visible;background:white;padding:16px';
          const clone = invoiceElement.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('.print\\:hidden').forEach(el => (el as HTMLElement).style.display = 'none');
          wrapper.appendChild(clone);
          document.body.appendChild(wrapper);
          
          await document.fonts.ready;
          await new Promise(r => setTimeout(r, 300));
          
          const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          document.body.removeChild(wrapper);
          
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pdfWidth - 10;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          const finalHeight = Math.min(imgHeight, pdfHeight - 10);
          const finalWidth = imgHeight > pdfHeight - 10 ? (canvas.width * finalHeight) / canvas.height : imgWidth;
          
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pdfWidth - finalWidth) / 2, 5, finalWidth, finalHeight);
          return pdf.output('blob');
        }}
        userEmail={userEmail}
        signatureSr={selectedCompany.email_signature_sr}
        signatureEn={selectedCompany.email_signature_en}
      />
    </div>
  );
}

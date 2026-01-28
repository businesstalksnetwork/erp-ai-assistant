import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PdfGeneratorOptions {
  invoiceNumber: string;
  invoiceType: 'regular' | 'proforma' | 'advance';
  returnBlob?: boolean;
}

/**
 * Zajednička funkcija za generisanje PDF-a fakture
 * Koristi se i za download i za email slanje
 * UVEK generiše svetlu (light mode) verziju PDF-a
 */
export async function generateInvoicePdf(
  options: PdfGeneratorOptions
): Promise<Blob | void> {
  const invoiceElement = document.querySelector('.print-invoice') as HTMLElement;
  if (!invoiceElement) {
    throw new Error('Invoice element not found');
  }

  // KRITIČNO: Privremeno ukloni dark mode da bi PDF bio svetao
  const htmlElement = document.documentElement;
  const wasDarkMode = htmlElement.classList.contains('dark');
  if (wasDarkMode) {
    htmlElement.classList.remove('dark');
  }

  // Detekcija mobilnog uređaja
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  // Kreiraj offscreen wrapper sa fiksnom A4 širinom
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px'; // A4 širina na 96dpi
  wrapper.style.minHeight = '1123px'; // A4 visina na 96dpi
  wrapper.style.height = 'auto';
  wrapper.style.overflow = 'visible';
  wrapper.style.background = '#ffffff';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.padding = '16px 16px 20px 16px';
  wrapper.className = 'pdf-export';

  // Kloniraj sadržaj fakture
  const clone = invoiceElement.cloneNode(true) as HTMLElement;

  // Osiguraj da clone ima sve potrebne stilove za pun prikaz
  clone.style.width = '100%';
  clone.style.height = 'auto';
  clone.style.minHeight = 'auto';
  clone.style.overflow = 'visible';
  clone.style.position = 'relative';
  clone.style.paddingBottom = '24px';
  clone.style.breakInside = 'avoid';
  clone.style.pageBreakInside = 'avoid';

  // Pronađi Card komponentu i forsiraj break-inside: avoid
  const cardElement = clone.querySelector('.rounded-lg');
  if (cardElement) {
    (cardElement as HTMLElement).style.breakInside = 'avoid';
    (cardElement as HTMLElement).style.pageBreakInside = 'avoid';

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

    // SPECIJALNI SLUČAJ: Tamni blokovi sa belim tekstom (ZA PLAĆANJE sekcija)
    // Ovi blokovi ostaju tamni jer su dizajnerski element
    const isDarkBlock = element.classList.contains('bg-slate-800') || 
                        element.classList.contains('bg-slate-900') ||
                        element.classList.contains('bg-gray-800') ||
                        element.classList.contains('bg-gray-900') ||
                        element.classList.contains('bg-primary');
    
    const isInsideDarkBlock = element.closest('.bg-slate-800, .bg-slate-900, .bg-gray-800, .bg-gray-900, .bg-primary');
    
    if (isDarkBlock) {
      // Zadrži tamnu pozadinu i beli tekst
      element.style.backgroundColor = '#1e293b'; // slate-800 u light mode
      element.style.color = '#ffffff';
      element.style.webkitTextFillColor = '#ffffff';
      return;
    }
    
    if (isInsideDarkBlock) {
      // Elementi unutar tamnog bloka ostaju sa belim tekstom
      if (element.classList.contains('text-white')) {
        element.style.color = '#ffffff';
        element.style.webkitTextFillColor = '#ffffff';
      } else if (element.classList.contains('text-slate-200') || element.classList.contains('text-slate-300')) {
        element.style.color = '#e2e8f0'; // Svetlo siva
        element.style.webkitTextFillColor = '#e2e8f0';
      }
      return;
    }

    // Default: čisto crn tekst za ostale elemente
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

    // Bela pozadina za sve kartice i kontejnere (osim tamnih blokova)
    if (computedStyle.backgroundColor !== 'transparent' && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const bg = computedStyle.backgroundColor;
      // Zadržaj samo bele/svetle pozadine
      if (!bg.includes('255, 255, 255') && !bg.includes('rgb(255')) {
        element.style.backgroundColor = '#ffffff';
      }
    }
    
    // Eksplicitno postavi pozadinu za elemente sa bg-secondary, bg-muted, itd.
    if (
      element.classList.contains('bg-secondary') ||
      element.classList.contains('bg-muted') ||
      element.classList.contains('bg-muted/50') ||
      element.classList.contains('bg-card') ||
      element.classList.contains('bg-background')
    ) {
      element.style.backgroundColor = '#f8f9fa'; // Svetlo siva umesto tamne
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

    // Pojačaj kontrast na canvas-u
    const boostCanvasContrast = (targetCanvas: HTMLCanvasElement) => {
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = targetCanvas;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // ULTRA agresivan prag - SVE što nije skoro potpuno belo postaje crno
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
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          }
        } else {
          if (luminance >= blackThreshold) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else if (luminance < 200) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
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

    // Margine za sigurnost
    const margin = 5;
    const usableWidth = pdfWidth - (margin * 2);
    const usableHeight = pdfHeight - (margin * 2);

    let finalWidth = usableWidth;
    let finalHeight = (canvas.height * usableWidth) / canvas.width;

    // Ako je previsoko, skaliraj da stane na jednu stranu
    if (finalHeight > usableHeight) {
      const scale = (usableHeight / finalHeight) * 0.98;
      finalWidth = usableWidth * scale;
      finalHeight = usableHeight * 0.98;
    }

    // Centriraj horizontalno i vertikalno
    const xOffset = (pdfWidth - finalWidth) / 2;
    const yOffset = (pdfHeight - finalHeight) / 2;

    // Na mobilnom koristi JPEG (manja memorija), na desktopu PNG
    const imageFormat = isMobile ? 'JPEG' : 'PNG';
    const imageData = isMobile
      ? canvas.toDataURL('image/jpeg', 0.92)
      : canvas.toDataURL('image/png');

    pdf.addImage(imageData, imageFormat, xOffset, yOffset, finalWidth, finalHeight);

    if (options.returnBlob) {
      return pdf.output('blob');
    }

    // Ime fajla bazirano na broju fakture
    const docType = options.invoiceType === 'proforma'
      ? 'Predracun'
      : options.invoiceType === 'advance'
        ? 'Avans'
        : 'Faktura';
    const fileName = `${docType}_${options.invoiceNumber.replace(/\//g, '-')}.pdf`;

    pdf.save(fileName);
  } finally {
    // Ukloni offscreen wrapper
    document.body.removeChild(wrapper);

    // KRITIČNO: Vrati dark mode ako je bio aktivan
    if (wasDarkMode) {
      htmlElement.classList.add('dark');
    }
  }
}

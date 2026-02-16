import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

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

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  // Kreiraj offscreen wrapper sa fiksnom A4 širinom
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px';
  wrapper.style.minHeight = '1123px';
  wrapper.style.height = 'auto';
  wrapper.style.overflow = 'visible';
  wrapper.style.background = '#ffffff';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.padding = '40px 16px 20px 16px';
  wrapper.className = 'pdf-export';

  // Kloniraj sadržaj fakture
  const clone = invoiceElement.cloneNode(true) as HTMLElement;

  clone.style.width = '100%';
  clone.style.height = 'auto';
  clone.style.minHeight = 'auto';
  clone.style.overflow = 'visible';
  clone.style.position = 'relative';
  clone.style.paddingBottom = '24px';
  clone.style.breakInside = 'avoid';
  clone.style.pageBreakInside = 'avoid';

  // Card break-inside fix
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

  // Fix table borders
  clone.querySelectorAll('table').forEach(table => {
    (table as HTMLElement).style.borderCollapse = 'collapse';
  });
  clone.querySelectorAll('.border, [class*="border-"]').forEach(el => {
    const element = el as HTMLElement;
    if (element.classList.contains('rounded-lg') && element.querySelector('table')) {
      element.style.border = '1px solid #d1d5db';
      element.style.overflow = 'hidden';
    }
  });

  // Sakrij print:hidden elemente
  clone.querySelectorAll('.print\\:hidden').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  // Konvertuj DO Spaces slike u base64
  const convertImageToBase64ViaEdgeFunction = async (imgUrl: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('storage-get-base64', {
        body: { url: imgUrl },
      });
      if (error || !data?.success) return null;
      return data.dataUrl;
    } catch (e) {
      return null;
    }
  };

  const images = Array.from(wrapper.querySelectorAll('img'));
  await Promise.all(images.map(async (img) => {
    if (img.src.startsWith('data:')) return;
    const isDoSpaces = img.src.includes('digitaloceanspaces.com');
    if (isDoSpaces) {
      const base64 = await convertImageToBase64ViaEdgeFunction(img.src);
      if (base64) {
        img.src = base64;
        await new Promise(resolve => {
          if (img.complete && img.naturalHeight > 0) resolve(null);
          else {
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 1000);
          }
        });
      }
    } else {
      if (!img.complete) {
        await new Promise(resolve => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(() => resolve(null), 2000);
        });
      }
    }
  }));

  // NUCLEAR FIX: Temporarily remove .dark class with visual overlay
  const isDark = document.documentElement.classList.contains('dark');
  let overlay: HTMLDivElement | null = null;

  if (isDark) {
    // Create overlay to prevent visual flash
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f1729;z-index:99999;pointer-events:none;';
    document.body.appendChild(overlay);
    // Remove dark class so html2canvas computes light-mode styles
    document.documentElement.classList.remove('dark');
  }

  // Inject stylesheet override so html2canvas picks up black text via getComputedStyle
  const styleOverride = document.createElement('style');
  styleOverride.textContent = `
    .pdf-export, .pdf-export * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    .pdf-export .bg-primary,
    .pdf-export .bg-primary * {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
  `;
  document.head.appendChild(styleOverride);

  try {
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 300));
    styleOverride.textContent = `
      .pdf-export, .pdf-export * {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
      }
      .pdf-export .bg-primary,
      .pdf-export .bg-primary * {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
      }
    `;
    document.head.appendChild(styleOverride);

    const actualHeight = wrapper.scrollHeight;
    wrapper.style.height = actualHeight + 'px';

    const canvasScale = isMobile ? 1.5 : 2;

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

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 5;
    const usableWidth = pdfWidth - (margin * 2);
    const usableHeight = pdfHeight - (margin * 2);

    let finalWidth = usableWidth;
    let finalHeight = (canvas.height * usableWidth) / canvas.width;

    if (finalHeight > usableHeight) {
      const scale = (usableHeight / finalHeight) * 0.98;
      finalWidth = usableWidth * scale;
      finalHeight = usableHeight * 0.98;
    }

    const xOffset = (pdfWidth - finalWidth) / 2;
    const yOffset = (pdfHeight - finalHeight) / 2;

    const imageFormat = isMobile ? 'JPEG' : 'PNG';
    const imageData = isMobile
      ? canvas.toDataURL('image/jpeg', 0.92)
      : canvas.toDataURL('image/png');

    pdf.addImage(imageData, imageFormat, xOffset, yOffset, finalWidth, finalHeight);

    if (options.returnBlob) {
      return pdf.output('blob');
    }

    const docType = options.invoiceType === 'proforma'
      ? 'Predracun'
      : options.invoiceType === 'advance'
        ? 'Avans'
        : 'Faktura';
    const fileName = `${docType}_${options.invoiceNumber.replace(/\//g, '-')}.pdf`;
    pdf.save(fileName);
  } finally {
    // Remove style override
    if (styleOverride.parentNode) {
      document.head.removeChild(styleOverride);
    }
    // Restore dark mode and remove overlay
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    }
    document.body.removeChild(wrapper);
  }
}

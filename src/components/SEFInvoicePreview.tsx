import React, { useMemo, useRef, useState } from 'react';
import { parseUBLInvoice, formatSEFDate, formatSEFAmount } from '@/lib/ubl-parser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Code, Printer, Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface SEFInvoicePreviewProps {
  xml: string;
  sefInvoiceId?: string;
  fetchedAt?: string;
  invoiceNumber?: string;
}

const SEFInvoicePreview: React.FC<SEFInvoicePreviewProps> = ({ 
  xml, 
  sefInvoiceId,
  fetchedAt,
  invoiceNumber 
}) => {
  const parsed = useMemo(() => parseUBLInvoice(xml), [xml]);
  const printRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  if (!parsed) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Nije moguće parsirati XML fakturu.</p>
        <pre className="mt-4 p-4 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono text-left">
          {xml}
        </pre>
      </div>
    );
  }

  const generatedDate = fetchedAt ? new Date(fetchedAt).toLocaleString('sr-RS') : new Date().toLocaleString('sr-RS');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    setIsGeneratingPdf(true);
    try {
      const element = printRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = Math.min((pdfWidth - 10) / imgWidth, (pdfHeight - 10) / imgHeight);
      const width = imgWidth * ratio;
      const height = imgHeight * ratio;
      
      const x = (pdfWidth - width) / 2;
      const y = 5;
      
      pdf.addImage(imgData, 'JPEG', x, y, width, height);
      
      const displayNumber = invoiceNumber || parsed.invoiceNumber || sefInvoiceId || 'faktura';
      const fileName = `SEF-${displayNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      
      pdf.save(fileName);
      toast.success('PDF uspešno sačuvan');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Greška pri generisanju PDF-a');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Tabs defaultValue="invoice" className="w-full">
      <TabsList className="mb-4 print:hidden">
        <TabsTrigger value="invoice" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Faktura
        </TabsTrigger>
        <TabsTrigger value="xml" className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          UBL XML
        </TabsTrigger>
      </TabsList>

      <TabsContent value="invoice" className="mt-0">
        {/* Print/PDF buttons - hidden during print */}
        <div className="flex justify-end gap-2 mb-4 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {isMobile ? 'Štampaj' : 'Preuzmi'}
          </Button>
          {isMobile && (
            <Button 
              size="sm" 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingPdf ? 'Generiše se...' : 'Sačuvaj PDF'}
            </Button>
          )}
        </div>

        <div ref={printRef} className="bg-background border rounded-lg overflow-hidden print:border-0 print:bg-white">
          {/* SEF Header */}
          <div className="bg-muted/50 px-4 py-3 border-b text-sm print:bg-gray-100">
            <p className="font-medium print:text-black">
              Generisano sistemom eFaktura pod brojem: {sefInvoiceId || parsed.sefId || '-'}
            </p>
            {parsed.sefId && (
              <p className="text-muted-foreground text-xs mt-1 print:text-gray-600">
                Identifikator: {parsed.sefId}
              </p>
            )}
            <p className="text-muted-foreground text-xs print:text-gray-600">
              Datum i vreme generisanja: {generatedDate}
            </p>
          </div>

          {/* Invoice Info Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-600">Datum izdavanja:</span>
              <p className="font-medium print:text-black">{formatSEFDate(parsed.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-600">Broj fakture:</span>
              <p className="font-medium print:text-black">{parsed.invoiceNumber || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-600">Datum prometa:</span>
              <p className="font-medium print:text-black">{formatSEFDate(parsed.serviceDate) || formatSEFDate(parsed.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-600">Rok plaćanja:</span>
              <p className="font-medium print:text-black">{formatSEFDate(parsed.dueDate) || '-'}</p>
            </div>
          </div>

          {/* Supplier and Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b">
            {/* Supplier */}
            <div className="p-4 border-b md:border-b-0 md:border-r">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide print:text-gray-600">
                Prodavac
              </h3>
              <div className="space-y-1 text-sm print:text-black">
                <p className="font-semibold text-base">{parsed.supplier.name || 'Nepoznat'}</p>
                {parsed.supplier.address && <p>{parsed.supplier.address}</p>}
                <p>
                  {[parsed.supplier.postalCode, parsed.supplier.city].filter(Boolean).join(' ')}
                </p>
                {parsed.supplier.pib && (
                  <p><span className="text-muted-foreground print:text-gray-600">PIB:</span> {parsed.supplier.pib}</p>
                )}
                {parsed.supplier.maticniBroj && (
                  <p><span className="text-muted-foreground print:text-gray-600">MB:</span> {parsed.supplier.maticniBroj}</p>
                )}
                {parsed.supplier.email && (
                  <p className="text-muted-foreground text-xs mt-2 print:text-gray-600">{parsed.supplier.email}</p>
                )}
                {parsed.supplier.phone && (
                  <p className="text-muted-foreground text-xs print:text-gray-600">{parsed.supplier.phone}</p>
                )}
              </div>
            </div>

            {/* Customer */}
            <div className="p-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide print:text-gray-600">
                Kupac
              </h3>
              <div className="space-y-1 text-sm print:text-black">
                <p className="font-semibold text-base">{parsed.customer.name || 'Nepoznat'}</p>
                {parsed.customer.address && <p>{parsed.customer.address}</p>}
                <p>
                  {[parsed.customer.postalCode, parsed.customer.city].filter(Boolean).join(' ')}
                </p>
                {parsed.customer.pib && (
                  <p><span className="text-muted-foreground print:text-gray-600">PIB:</span> {parsed.customer.pib}</p>
                )}
                {parsed.customer.maticniBroj && (
                  <p><span className="text-muted-foreground print:text-gray-600">MB:</span> {parsed.customer.maticniBroj}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide print:text-gray-600">
              Stavke fakture
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-black">
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    <th className="text-left p-2 font-medium">Opis</th>
                    <th className="text-right p-2 font-medium">Količina</th>
                    <th className="text-right p-2 font-medium">Jed. cena</th>
                    <th className="text-center p-2 font-medium">J.m.</th>
                    <th className="text-right p-2 font-medium">Iznos</th>
                    <th className="text-right p-2 font-medium">PDV %</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.length > 0 ? (
                    parsed.items.map((item, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="p-2 max-w-[200px] truncate" title={item.description}>
                          {item.description || '-'}
                        </td>
                        <td className="text-right p-2">{item.quantity}</td>
                        <td className="text-right p-2">
                          {new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2 }).format(item.unitPrice)}
                        </td>
                        <td className="text-center p-2">{item.unitOfMeasure}</td>
                        <td className="text-right p-2">
                          {new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2 }).format(item.netAmount)}
                        </td>
                        <td className="text-right p-2">{item.vatRate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center p-4 text-muted-foreground print:text-gray-600">
                        Nema stavki
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="p-4 border-b">
            <div className="max-w-sm ml-auto space-y-2 text-sm print:text-black">
              {/* VAT Breakdown */}
              {parsed.vatBreakdown.map((vat, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Osnovica ({vat.rate}%):
                  </span>
                  <span>{formatSEFAmount(vat.base, parsed.currency)}</span>
                </div>
              ))}
              
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-gray-600">Ukupna osnovica:</span>
                <span>{formatSEFAmount(parsed.subtotal, parsed.currency)}</span>
              </div>
              
              {parsed.vatBreakdown.map((vat, index) => (
                <div key={`vat-${index}`} className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    PDV ({vat.rate}%):
                  </span>
                  <span>{formatSEFAmount(vat.amount, parsed.currency)}</span>
                </div>
              ))}
              
              {parsed.totalVat > 0 && parsed.vatBreakdown.length > 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">Ukupan PDV:</span>
                  <span>{formatSEFAmount(parsed.totalVat, parsed.currency)}</span>
                </div>
              )}
              
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold text-base">
                  <span>UKUPNO ZA PLAĆANJE:</span>
                  <span className="text-primary print:text-black">{formatSEFAmount(parsed.payableAmount, parsed.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(parsed.bankAccount || parsed.paymentReference) && (
            <div className="p-4 border-b bg-muted/30 print:bg-gray-50">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide print:text-gray-600">
                Podaci za plaćanje
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm print:text-black">
                {parsed.bankAccount && (
                  <div>
                    <span className="text-muted-foreground print:text-gray-600">Račun:</span>
                    <span className="ml-2 font-medium">{parsed.bankAccount}</span>
                  </div>
                )}
                {parsed.paymentReference && (
                  <div>
                    <span className="text-muted-foreground print:text-gray-600">Poziv na broj:</span>
                    <span className="ml-2 font-medium">{parsed.paymentReference}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          {parsed.note && (
            <div className="p-4 text-sm print:text-black">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide print:text-gray-600">
                Napomena
              </h3>
              <p className="whitespace-pre-line">{parsed.note}</p>
            </div>
          )}

          {/* Footer with contact */}
          {(parsed.supplier.email || parsed.supplier.phone || parsed.supplier.website) && (
            <div className="bg-muted/30 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-4 print:bg-gray-50 print:text-gray-600">
              {parsed.supplier.email && (
                <span>Email: {parsed.supplier.email}</span>
              )}
              {parsed.supplier.phone && (
                <span>Tel: {parsed.supplier.phone}</span>
              )}
              {parsed.supplier.website && (
                <span>Web: {parsed.supplier.website}</span>
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="xml" className="mt-0">
        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto print:hidden">
          {xml}
        </pre>
      </TabsContent>
    </Tabs>
  );
};

export default SEFInvoicePreview;
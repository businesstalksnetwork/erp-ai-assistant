import React, { useMemo } from 'react';
import { parseUBLInvoice, formatSEFDate, formatSEFAmount } from '@/lib/ubl-parser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Code } from 'lucide-react';

interface SEFInvoicePreviewProps {
  xml: string;
  sefInvoiceId?: string;
  fetchedAt?: string;
}

const SEFInvoicePreview: React.FC<SEFInvoicePreviewProps> = ({ 
  xml, 
  sefInvoiceId,
  fetchedAt 
}) => {
  const parsed = useMemo(() => parseUBLInvoice(xml), [xml]);
  
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

  return (
    <Tabs defaultValue="invoice" className="w-full">
      <TabsList className="mb-4">
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
        <div className="bg-background border rounded-lg overflow-hidden print:border-0">
          {/* SEF Header */}
          <div className="bg-muted/50 px-4 py-3 border-b text-sm">
            <p className="font-medium">
              Generisano sistemom eFaktura pod brojem: {sefInvoiceId || parsed.sefId || '-'}
            </p>
            {parsed.sefId && (
              <p className="text-muted-foreground text-xs mt-1">
                Identifikator: {parsed.sefId}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Datum i vreme generisanja: {generatedDate}
            </p>
          </div>

          {/* Invoice Info Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b text-sm">
            <div>
              <span className="text-muted-foreground">Datum izdavanja:</span>
              <p className="font-medium">{formatSEFDate(parsed.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Broj fakture:</span>
              <p className="font-medium">{parsed.invoiceNumber || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Datum prometa:</span>
              <p className="font-medium">{formatSEFDate(parsed.serviceDate) || formatSEFDate(parsed.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Rok plaćanja:</span>
              <p className="font-medium">{formatSEFDate(parsed.dueDate) || '-'}</p>
            </div>
          </div>

          {/* Supplier and Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b">
            {/* Supplier */}
            <div className="p-4 border-b md:border-b-0 md:border-r">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide">
                Prodavac
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{parsed.supplier.name || 'Nepoznat'}</p>
                {parsed.supplier.address && <p>{parsed.supplier.address}</p>}
                <p>
                  {[parsed.supplier.postalCode, parsed.supplier.city].filter(Boolean).join(' ')}
                </p>
                {parsed.supplier.pib && (
                  <p><span className="text-muted-foreground">PIB:</span> {parsed.supplier.pib}</p>
                )}
                {parsed.supplier.maticniBroj && (
                  <p><span className="text-muted-foreground">MB:</span> {parsed.supplier.maticniBroj}</p>
                )}
                {parsed.supplier.email && (
                  <p className="text-muted-foreground text-xs mt-2">{parsed.supplier.email}</p>
                )}
                {parsed.supplier.phone && (
                  <p className="text-muted-foreground text-xs">{parsed.supplier.phone}</p>
                )}
              </div>
            </div>

            {/* Customer */}
            <div className="p-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide">
                Kupac
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{parsed.customer.name || 'Nepoznat'}</p>
                {parsed.customer.address && <p>{parsed.customer.address}</p>}
                <p>
                  {[parsed.customer.postalCode, parsed.customer.city].filter(Boolean).join(' ')}
                </p>
                {parsed.customer.pib && (
                  <p><span className="text-muted-foreground">PIB:</span> {parsed.customer.pib}</p>
                )}
                {parsed.customer.maticniBroj && (
                  <p><span className="text-muted-foreground">MB:</span> {parsed.customer.maticniBroj}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
              Stavke fakture
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
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
                      <td colSpan={6} className="text-center p-4 text-muted-foreground">
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
            <div className="max-w-sm ml-auto space-y-2 text-sm">
              {/* VAT Breakdown */}
              {parsed.vatBreakdown.map((vat, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground">
                    Osnovica ({vat.rate}%):
                  </span>
                  <span>{formatSEFAmount(vat.base, parsed.currency)}</span>
                </div>
              ))}
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ukupna osnovica:</span>
                <span>{formatSEFAmount(parsed.subtotal, parsed.currency)}</span>
              </div>
              
              {parsed.vatBreakdown.map((vat, index) => (
                <div key={`vat-${index}`} className="flex justify-between">
                  <span className="text-muted-foreground">
                    PDV ({vat.rate}%):
                  </span>
                  <span>{formatSEFAmount(vat.amount, parsed.currency)}</span>
                </div>
              ))}
              
              {parsed.totalVat > 0 && parsed.vatBreakdown.length > 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ukupan PDV:</span>
                  <span>{formatSEFAmount(parsed.totalVat, parsed.currency)}</span>
                </div>
              )}
              
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold text-base">
                  <span>UKUPNO ZA PLAĆANJE:</span>
                  <span className="text-primary">{formatSEFAmount(parsed.payableAmount, parsed.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(parsed.bankAccount || parsed.paymentReference) && (
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide">
                Podaci za plaćanje
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {parsed.bankAccount && (
                  <div>
                    <span className="text-muted-foreground">Račun:</span>
                    <span className="ml-2 font-medium">{parsed.bankAccount}</span>
                  </div>
                )}
                {parsed.paymentReference && (
                  <div>
                    <span className="text-muted-foreground">Poziv na broj:</span>
                    <span className="ml-2 font-medium">{parsed.paymentReference}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          {parsed.note && (
            <div className="p-4 text-sm">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 uppercase tracking-wide">
                Napomena
              </h3>
              <p className="whitespace-pre-line">{parsed.note}</p>
            </div>
          )}

          {/* Footer with contact */}
          {(parsed.supplier.email || parsed.supplier.phone || parsed.supplier.website) && (
            <div className="bg-muted/30 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-4">
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
        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
          {xml}
        </pre>
      </TabsContent>
    </Tabs>
  );
};

export default SEFInvoicePreview;

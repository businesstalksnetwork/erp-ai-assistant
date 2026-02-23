import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export type PausalniType = 'porez' | 'doprinosi';

export interface MonthlyEntry {
  month: number; // 1-12
  pio: number;
  zdravstveno: number;
  nezaposlenost: number;
}

export interface ParsedPausalniData {
  type: PausalniType;
  year: number;
  monthlyAmounts: number[]; // For porez
  entries?: MonthlyEntry[]; // For doprinosi - only months that exist
  recipientName: string;
  recipientAccount: string;
  paymentModel: string;
  paymentReference: string;
  paymentCode: string;
  payerName: string;
}

interface PausalniPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PausalniType;
  onDataParsed: (data: ParsedPausalniData) => void;
}

const typeLabels: Record<PausalniType, string> = {
  porez: 'Porez na paušalni prihod',
  doprinosi: 'Doprinosi (PIO, Zdravstveno, Nezaposlenost)',
};

const typeDescriptions: Record<PausalniType, string> = {
  porez: 'Učitajte PDF rešenje za porez (PAUS-RESPOR)',
  doprinosi: 'Učitajte PDF rešenje za doprinose (PAUS-RESDOP) - kreira podsetnike samo za tipove i mesece koji postoje u dokumentu',
};

const months = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];

export default function PausalniPdfDialog({ 
  open, 
  onOpenChange, 
  type, 
  onDataParsed 
}: PausalniPdfDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedPausalniData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Samo PDF fajlovi su dozvoljeni');
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      // Read PDF as ArrayBuffer and convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 for sending to edge function
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      
      console.log('Sending PDF to edge function, size:', base64.length);

      // Call edge function to parse
      const { data, error: fnError } = await supabase.functions.invoke('parse-pausalni-pdf', {
        body: { pdfBase64: base64, type }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Validate that we got actual data
      if (type === 'porez' && (!data.monthlyAmounts || data.monthlyAmounts[0] === 0)) {
        throw new Error('Nije moguće izvući iznose iz PDF-a. Proverite da li ste učitali ispravno rešenje za porez.');
      }
      
      if (type === 'doprinosi') {
        // New validation for entries-based structure
        if (!data.entries || data.entries.length === 0) {
          throw new Error('Nije moguće izvući podatke iz PDF-a. Proverite da li ste učitali ispravno rešenje za doprinose.');
        }
        
        // Check if at least one entry has a non-zero amount
        const hasAnyAmount = data.entries.some(
          (e: MonthlyEntry) => e.pio > 0 || e.zdravstveno > 0 || e.nezaposlenost > 0
        );
        
        if (!hasAnyAmount) {
          throw new Error('PDF ne sadrži iznose za doprinose. Proverite da li ste učitali ispravno rešenje.');
        }
      }

      setParsedData(data);
    } catch (err) {
      console.error('Error parsing PDF:', err);
      setError(err instanceof Error ? err.message : 'Greška pri obradi PDF-a');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (parsedData) {
      onDataParsed(parsedData);
      handleClose();
    }
  };

  const handleClose = () => {
    setParsedData(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sr-RS', {
      style: 'currency',
      currency: 'RSD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate reminder count for doprinosi
  const reminderCount = useMemo(() => {
    if (!parsedData || parsedData.type !== 'doprinosi' || !parsedData.entries) {
      return 0;
    }
    
    let count = 0;
    for (const entry of parsedData.entries) {
      if (entry.pio > 0) count++;
      if (entry.zdravstveno > 0) count++;
      if (entry.nezaposlenost > 0) count++;
    }
    return count;
  }, [parsedData]);

  // Detect which contribution types exist
  const detectedTypes = useMemo(() => {
    if (!parsedData?.entries) return { pio: false, zdravstveno: false, nezaposlenost: false };
    
    return {
      pio: parsedData.entries.some(e => e.pio > 0),
      zdravstveno: parsedData.entries.some(e => e.zdravstveno > 0),
      nezaposlenost: parsedData.entries.some(e => e.nezaposlenost > 0),
    };
  }, [parsedData]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{typeLabels[type]}</DialogTitle>
          <DialogDescription>
            {typeDescriptions[type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />

          {!parsedData && !isLoading && (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-dashed"
            >
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span>Kliknite za učitavanje PDF-a</span>
                <span className="text-xs text-muted-foreground">
                  Podržani format: PDF rešenje Poreske uprave
                </span>
              </div>
            </Button>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Obrađujem PDF...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {parsedData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg">
                <Check className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">PDF uspešno obrađen!</p>
              </div>

              <div className="space-y-3 p-4 bg-secondary rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tip:</span>
                  <span className="text-sm font-medium">{typeLabels[parsedData.type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Godina:</span>
                  <span className="text-sm font-medium">{parsedData.year}</span>
                </div>
                
                {parsedData.type === 'doprinosi' && parsedData.entries ? (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-muted-foreground mb-2">Pronađeni tipovi doprinosa:</p>
                      <div className="flex gap-2 flex-wrap mb-3">
                        {detectedTypes.pio && (
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">PIO</span>
                        )}
                        {detectedTypes.zdravstveno && (
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Zdravstveno</span>
                        )}
                        {detectedTypes.nezaposlenost && (
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Nezaposlenost</span>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2">Mesečni iznosi:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {parsedData.entries.map(entry => (
                          <div key={entry.month} className="text-sm border-b border-border/50 pb-2 last:border-0">
                            <div className="font-medium text-foreground mb-1">
                              {months[entry.month - 1]}:
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-xs">
                              {entry.pio > 0 && (
                                <span>PIO: {formatCurrency(entry.pio)}</span>
                              )}
                              {entry.zdravstveno > 0 && (
                                <span>ZDR: {formatCurrency(entry.zdravstveno)}</span>
                              )}
                              {entry.nezaposlenost > 0 && (
                                <span>NEZ: {formatCurrency(entry.nezaposlenost)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mesečni iznos:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(parsedData.monthlyAmounts[0] || 0)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Model:</span>
                  <span className="text-sm font-medium">{parsedData.paymentModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Poziv na broj:</span>
                  <span className="text-sm font-medium font-mono">{parsedData.paymentReference || '-'}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {parsedData.type === 'doprinosi' 
                  ? `Biće kreirano ${reminderCount} podsetnika za ${parsedData.year}. godinu`
                  : `Biće kreirano 12 podsetnika za svaki mesec u ${parsedData.year}. godini`
                }
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Otkaži
          </Button>
          {parsedData && (
            <Button onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4" />
              {parsedData.type === 'doprinosi' ? `Kreiraj ${reminderCount} podsetnika` : 'Kreiraj 12 podsetnika'}
            </Button>
          )}
          {error && (
            <Button onClick={() => fileInputRef.current?.click()}>
              Pokušaj ponovo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

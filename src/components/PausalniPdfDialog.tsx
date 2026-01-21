import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export type PausalniType = 'porez' | 'pio' | 'zdravstveno' | 'nezaposlenost';

interface ParsedPausalniData {
  type: PausalniType;
  year: number;
  monthlyAmounts: number[];
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
  pio: 'PIO doprinos (24%)',
  zdravstveno: 'Zdravstveno osiguranje (10,3%)',
  nezaposlenost: 'Nezaposlenost (0,75%)',
};

const typeDescriptions: Record<PausalniType, string> = {
  porez: 'Učitajte PDF rešenje za porez (PAUS-RESPOR)',
  pio: 'Učitajte PDF rešenje za doprinose (PAUS-RESDOP)',
  zdravstveno: 'Učitajte PDF rešenje za doprinose (PAUS-RESDOP)',
  nezaposlenost: 'Učitajte PDF rešenje za doprinose (PAUS-RESDOP)',
};

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
      // Read PDF as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Extract text from PDF using PDF.js-like approach
      // For now, we'll send the raw text extraction to the edge function
      // which will use AI to parse it
      
      // Convert to base64 for sending
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      uint8Array.forEach(byte => binary += String.fromCharCode(byte));
      
      // Simple text extraction from PDF (basic approach)
      // Look for text streams in PDF
      const text = extractTextFromPdf(uint8Array);
      
      console.log('Extracted text length:', text.length);
      console.log('First 500 chars:', text.substring(0, 500));

      // Call edge function to parse
      const { data, error: fnError } = await supabase.functions.invoke('parse-pausalni-pdf', {
        body: { pdfText: text, type }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setParsedData(data);
    } catch (err) {
      console.error('Error parsing PDF:', err);
      setError(err instanceof Error ? err.message : 'Greška pri obradi PDF-a');
    } finally {
      setIsLoading(false);
    }
  };

  // Basic PDF text extraction
  function extractTextFromPdf(data: Uint8Array): string {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    
    // Extract text between stream and endstream markers
    const streams: string[] = [];
    let pos = 0;
    
    while (pos < text.length) {
      const streamStart = text.indexOf('stream', pos);
      if (streamStart === -1) break;
      
      const streamEnd = text.indexOf('endstream', streamStart);
      if (streamEnd === -1) break;
      
      const content = text.substring(streamStart + 6, streamEnd);
      // Try to decode if it contains readable text
      if (content.length > 0) {
        // Look for text operators like Tj, TJ, '
        const textMatches = content.match(/\(([^)]+)\)/g);
        if (textMatches) {
          streams.push(...textMatches.map(m => m.slice(1, -1)));
        }
      }
      pos = streamEnd + 9;
    }
    
    // Also try to find any Unicode/UTF text patterns
    const unicodeText = text.match(/[\u0400-\u04FF\u0000-\u007F]+/g);
    if (unicodeText) {
      streams.push(...unicodeText.filter(t => t.length > 2));
    }
    
    // Join all extracted text
    const extracted = streams.join(' ');
    
    // If we got very little text, return the raw content for AI to process
    if (extracted.length < 100) {
      // Return cleaned raw content
      return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
                 .replace(/\s+/g, ' ')
                 .substring(0, 50000); // Limit size
    }
    
    return extracted;
  }

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mesečni iznos:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(parsedData.monthlyAmounts[0] || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Račun:</span>
                  <span className="text-sm font-medium font-mono">{parsedData.recipientAccount}</span>
                </div>
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
                Biće kreirano 12 podsetnika za svaki mesec u {parsedData.year}. godini
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
              Kreiraj 12 podsetnika
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

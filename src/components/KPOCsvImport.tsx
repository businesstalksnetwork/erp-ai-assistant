import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedEntry {
  ordinal_number: number;
  document_date: string | null;
  description: string;
  products_amount: number;
  services_amount: number;
  total_amount: number;
}

interface Props {
  companyId: string;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KPOCsvImport({ companyId, year, open, onOpenChange }: Props) {
  const [parsedData, setParsedData] = useState<ParsedEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(year);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  // Generate year options (current year +1 to -5)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);

  const parseNumber = (value: string): number => {
    if (!value || value.trim() === '' || value.trim() === '-') return 0;
    
    let cleaned = value.trim().replace(/\s/g, '');
    
    // Handle format: 47,000.00 (comma as thousands, dot as decimal)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/,/g, '');
    } 
    // Handle format: 47.000,00 (dot as thousands, comma as decimal)
    else if (cleaned.includes('.') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Handle format: 47000,00 (only comma as decimal)
    else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseDate = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    const trimmed = value.trim();
    
    // Try ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // Try DD.MM.YYYY format (full year)
    const matchFull = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (matchFull) {
      const [, day, month, yearPart] = matchFull;
      return `${yearPart}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try DD.MM.YY format (short year)
    const matchShort = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
    if (matchShort) {
      const [, day, month, shortYear] = matchShort;
      const fullYear = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const entries: ParsedEntry[] = [];
    const parseErrors: string[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by semicolon (common in Serbian CSV exports)
      let cols = line.split(';');
      
      // Fallback to comma if semicolon doesn't work
      if (cols.length < 3) {
        cols = line.split(',');
      }

      // Expected format: R.br.; Datum; Opis; Proizvodi (RSD); Usluge (RSD); Ukupno (RSD)
      if (cols.length < 3) {
        parseErrors.push(`Red ${i + 1}: Nedovoljan broj kolona`);
        continue;
      }

      // Skip summary row
      const description = cols[2]?.replace(/^"|"$/g, '').trim() || '';
      if (description.toUpperCase().includes('UKUPNO')) continue;

      const entry: ParsedEntry = {
        ordinal_number: parseInt(cols[0]) || i,
        document_date: parseDate(cols[1] || ''),
        description: description,
        products_amount: parseNumber(cols[3] || '0'),
        services_amount: parseNumber(cols[4] || '0'),
        total_amount: parseNumber(cols[5] || '0'),
      };

      // Validate required fields
      if (!entry.description) {
        parseErrors.push(`Red ${i + 1}: Nedostaje opis`);
        continue;
      }

      // If total is 0 but products/services exist, calculate it
      if (entry.total_amount === 0 && (entry.products_amount > 0 || entry.services_amount > 0)) {
        entry.total_amount = entry.products_amount + entry.services_amount;
      }

      entries.push(entry);
    }

    setParsedData(entries);
    setErrors(parseErrors);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    
    setIsImporting(true);
    try {
      // Get the maximum ordinal_number for this company and year
      const { data: existingEntries } = await supabase
        .from('kpo_entries')
        .select('ordinal_number')
        .eq('company_id', companyId)
        .eq('year', selectedYear)
        .order('ordinal_number', { ascending: false })
        .limit(1);
      
      const startOrdinal = (existingEntries?.[0]?.ordinal_number || 0) + 1;
      
      const entriesToInsert = parsedData.map((entry, index) => ({
        company_id: companyId,
        year: selectedYear,
        ordinal_number: startOrdinal + index,
        document_date: entry.document_date,
        description: entry.description,
        products_amount: entry.products_amount,
        services_amount: entry.services_amount,
        total_amount: entry.total_amount,
      }));

      const { error } = await supabase.from('kpo_entries').insert(entriesToInsert);

      if (error) throw error;

      toast.success(`Uvezeno ${entriesToInsert.length} KPO unosa`);
      onOpenChange(false);
      setParsedData([]);
      setFileName(null);
      setErrors([]);
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['kpo-years'] });
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Greška pri uvozu podataka');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setParsedData([]);
      setFileName(null);
      setErrors([]);
      setSelectedYear(year);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('sr-RS', {
      style: 'currency',
      currency: 'RSD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uvoz KPO knjige iz CSV-a</DialogTitle>
        </DialogHeader>

        {/* Year selection */}
        <div className="space-y-2">
          <Label>Godina za uvoz</Label>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Izaberi godinu" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}. godina
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File upload area */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".csv,.txt"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {fileName || 'Izaberi CSV fajl'}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Očekivani format: R.br.; Datum; Opis; Proizvodi; Usluge; Ukupno
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Separator: tačka-zarez (;) ili zarez (,)
          </p>
        </div>

        {/* Preview parsed data */}
        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Pronađeno {parsedData.length} unosa za uvoz u {selectedYear}. godinu</span>
            </div>

            {/* Table preview */}
            <div className="max-h-64 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-16">R.br.</th>
                    <th className="p-2 text-left w-24">Datum</th>
                    <th className="p-2 text-left">Opis</th>
                    <th className="p-2 text-right w-28">Ukupno</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((entry, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono">{entry.ordinal_number}</td>
                      <td className="p-2 text-muted-foreground">
                        {entry.document_date || '-'}
                      </td>
                      <td className="p-2 truncate max-w-[200px]">{entry.description}</td>
                      <td className="p-2 text-right font-mono">
                        {formatCurrency(entry.total_amount)}
                      </td>
                    </tr>
                  ))}
                  {parsedData.length > 10 && (
                    <tr className="border-t bg-muted/50">
                      <td colSpan={4} className="p-2 text-center text-muted-foreground">
                        ... i još {parsedData.length - 10} unosa
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-muted-foreground">Proizvodi</p>
                  <p className="font-semibold">
                    {formatCurrency(parsedData.reduce((sum, e) => sum + e.products_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usluge</p>
                  <p className="font-semibold">
                    {formatCurrency(parsedData.reduce((sum, e) => sum + e.services_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ukupno</p>
                  <p className="font-bold">
                    {formatCurrency(parsedData.reduce((sum, e) => sum + e.total_amount, 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Upozorenja pri parsiranju:</span>
                </div>
                <ul className="text-sm text-yellow-600 dark:text-yellow-500 mt-1 list-disc list-inside">
                  {errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {errors.length > 5 && <li>... i još {errors.length - 5} upozorenja</li>}
                </ul>
              </div>
            )}

            <Button onClick={handleImport} disabled={isImporting} className="w-full">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uvoz u toku...
                </>
              ) : (
                `Uvezi ${parsedData.length} unosa`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

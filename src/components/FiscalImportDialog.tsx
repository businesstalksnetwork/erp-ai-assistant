import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Package, Wrench, Home, Globe } from 'lucide-react';
import { ParsedFiscalData, useFiscalEntries, KpoItemType } from '@/hooks/useFiscalEntries';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface FiscalImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseExcelDate(dateValue: string | number): string {
  if (typeof dateValue === 'number') {
    // Excel serial date number
    const date = XLSX.SSF.parse_date_code(dateValue);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  
  if (typeof dateValue === 'string') {
    const cleanedValue = dateValue.trim();
    
    // Handle format: "04.11.2025. 11:36:12" (with trailing dot after year and time)
    // Extract date part before time (space separator)
    const datePart = cleanedValue.split(' ')[0];
    
    // Parse DD.MM.YYYY. or DD.MM.YYYY format
    const parts = datePart.replace(/\.$/, '').split('.');
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Already in ISO format
    if (cleanedValue.includes('-')) {
      return cleanedValue.split('T')[0];
    }
  }
  
  // Fallback to today
  return new Date().toISOString().split('T')[0];
}

export function FiscalImportDialog({ open, onOpenChange, companyId }: FiscalImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedFiscalData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kpoItemType, setKpoItemType] = useState<KpoItemType>('products');
  const [isForeign, setIsForeign] = useState(false);
  
  const { importFiscalData } = useFiscalEntries(companyId);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setParsing(true);
    setParsedData([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      // Find header row - look for columns that indicate this is a fiscal report
      // Possible column names: "Врста рачуна" or "Врста промета", "Тип трансакције", "Укупан износ"
      let headerRowIndex = -1;
      let columns: Record<string, number> = {};
      
      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i];
        if (row && Array.isArray(row)) {
          // Look for key columns that identify the header row
          const hasVrstaRacuna = row.some((cell: any) => 
            typeof cell === 'string' && (cell.includes('Врста рачуна') || cell.includes('Врста промета'))
          );
          const hasTipTransakcije = row.some((cell: any) => 
            typeof cell === 'string' && cell.includes('Тип трансакције')
          );
          
          if (hasVrstaRacuna && hasTipTransakcije) {
            headerRowIndex = i;
            // Map column names to indices
            row.forEach((cell: any, index: number) => {
              if (typeof cell === 'string') {
                columns[cell.trim()] = index;
              }
            });
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Nije pronađeno zaglavlje tabele. Proverite format Excel fajla.');
      }

      // Parse data rows
      const entries: ParsedFiscalData[] = [];
      
      // Column name variations
      const vrstaCol = columns['Врста рачуна'] ?? columns['Врста промета'];
      const tipCol = columns['Тип трансакције'];
      const datumCol = columns['ПФР време (временска зона сервера)'] ?? columns['Датум и време промета'] ?? columns['Датум промета'];
      const poslovniProstorCol = columns['Назив пословног простора'];
      const brojRacunaCol = columns['Бројач рачуна'] ?? columns['Број рачуна'];
      const ukupanIznosCol = columns['Укупан износ'];
      // Full unique ID column - "Затражио - Потписао - Бројач" contains the full receipt ID
      const puniIdCol = columns['Затражио - Потписао - Бројач'];
      
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        // Get values using the mapped columns
        const vrstaPrometa = vrstaCol !== undefined ? row[vrstaCol]?.toString().trim() : '';
        const tipTransakcije = tipCol !== undefined ? row[tipCol]?.toString().trim() : '';
        
        // Only include "Промет" entries (not "Аванс")
        // And only "Продаја" and "Рефундација" (not other types)
        if (vrstaPrometa === 'Промет' && (tipTransakcije === 'Продаја' || tipTransakcije === 'Рефундација')) {
          const datum = datumCol !== undefined ? row[datumCol] : null;
          const poslovniProstor = poslovniProstorCol !== undefined ? row[poslovniProstorCol]?.toString() || '' : '';
          const brojRacunaKratak = brojRacunaCol !== undefined ? row[brojRacunaCol]?.toString() || '' : '';
          const ukupanIznosRaw = ukupanIznosCol !== undefined ? row[ukupanIznosCol]?.toString() || '0' : '0';
          // Handle both comma and period as decimal separator, and remove thousands separators
          const ukupanIznos = parseFloat(ukupanIznosRaw.replace(/,/g, '.').replace(/\s/g, '')) || 0;
          
          // Use full unique ID from "Затражио - Потписао - Бројач" column if available
          // This column contains unique IDs like "GWC64893-C38FDVO0-20" instead of short "20/20ПП"
          const puniId = puniIdCol !== undefined ? row[puniIdCol]?.toString().trim() || '' : '';
          // Use full ID if available, otherwise fall back to short number
          const receiptNumber = puniId || brojRacunaKratak;
          
          if (receiptNumber && ukupanIznos !== 0) {
            entries.push({
              entry_date: parseExcelDate(datum),
              business_name: poslovniProstor,
              receipt_number: receiptNumber,
              transaction_type: tipTransakcije as 'Продаја' | 'Рефундација',
              amount: Math.abs(ukupanIznos),
            });
          }
        }
      }

      if (entries.length === 0) {
        throw new Error('Nisu pronađeni validni fiskalni računi (Промет/Продаја ili Рефундација).');
      }

      setParsedData(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri parsiranju fajla');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedData.length === 0) return;
    
    await importFiscalData.mutateAsync({ entries: parsedData, companyId, kpoItemType, isForeign });
    setParsedData([]);
    setFile(null);
    setKpoItemType('products');
    setIsForeign(false);
    onOpenChange(false);
  }, [parsedData, companyId, importFiscalData, onOpenChange, kpoItemType, isForeign]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      
      // Trigger the file change handler manually
      setFile(droppedFile);
      // Process file
      const event = { target: { files: [droppedFile] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  }, [handleFileChange]);

  const salesTotal = parsedData.filter(e => e.transaction_type === 'Продаја').reduce((sum, e) => sum + e.amount, 0);
  const refundsTotal = parsedData.filter(e => e.transaction_type === 'Рефундација').reduce((sum, e) => sum + e.amount, 0);
  const netTotal = salesTotal - refundsTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Uvoz fiskalnih računa
          </DialogTitle>
          <DialogDescription>
            Uvezite Excel fajl iz fiskalne kase. Samo računi tipa "Промет" (Продаја i Рефундација) će biti uvezeni.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Upload Area */}
          {!parsedData.length && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Prevucite Excel fajl ovde</p>
              <p className="text-sm text-muted-foreground mb-4">ili</p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
                disabled={parsing}
              />
            </div>
          )}

          {/* Parsing State */}
          {parsing && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span>Parsiranje fajla...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview Data */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">
                    Pronađeno {parsedData.length} računa
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setParsedData([]);
                  setFile(null);
                }}>
                  Izaberi drugi fajl
                </Button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Prodaje</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(salesTotal)}</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Refundacije</p>
                  <p className="text-lg font-bold text-red-600">-{formatCurrency(refundsTotal)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Neto iznos</p>
                  <p className="text-lg font-bold">{formatCurrency(netTotal)}</p>
                </div>
              </div>

              {/* KPO Item Type Selection */}
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3">Evidentiraj u KPO kao:</p>
                  <RadioGroup 
                    value={kpoItemType} 
                    onValueChange={(value) => setKpoItemType(value as KpoItemType)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="products" id="products" />
                      <Label htmlFor="products" className="flex items-center gap-2 cursor-pointer">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Proizvodi
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="services" id="services" />
                      <Label htmlFor="services" className="flex items-center gap-2 cursor-pointer">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        Usluge
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-3">Tip prometa:</p>
                  <RadioGroup 
                    value={isForeign ? 'foreign' : 'domestic'} 
                    onValueChange={(value) => setIsForeign(value === 'foreign')}
                    className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="domestic" id="domestic" />
                      <Label htmlFor="domestic" className="flex items-center gap-2 cursor-pointer">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span>Domaći promet</span>
                        <span className="text-xs text-muted-foreground">(ulazi u limit od 8M)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="foreign" id="foreign" />
                      <Label htmlFor="foreign" className="flex items-center gap-2 cursor-pointer">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>Strani promet</span>
                        <span className="text-xs text-muted-foreground">(ne ulazi u limit od 8M)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Broj računa</TableHead>
                      <TableHead>Poslovni prostor</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead className="text-right">Iznos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(entry.entry_date).toLocaleDateString('sr-RS')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{entry.receipt_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{entry.business_name}</TableCell>
                        <TableCell>
                          <Badge variant={entry.transaction_type === 'Продаја' ? 'default' : 'destructive'}>
                            {entry.transaction_type === 'Продаја' ? 'Prodaja' : 'Refundacija'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${entry.transaction_type === 'Рефундација' ? 'text-red-600' : ''}`}>
                          {entry.transaction_type === 'Рефундација' ? '-' : ''}{formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Otkaži
                </Button>
                <Button onClick={handleImport} disabled={importFiscalData.isPending}>
                  {importFiscalData.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uvoženje...
                    </>
                  ) : (
                    <>Uvezi {parsedData.length} računa</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

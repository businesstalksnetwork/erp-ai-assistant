import { useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useKPO } from '@/hooks/useKPO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, Building2, Download, FileText, Loader2, MoreVertical, Trash2, Upload } from 'lucide-react';
import { KPOCsvImport } from '@/components/KPOCsvImport';
import { toast } from 'sonner';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function KPOBook() {
  const { selectedCompany } = useSelectedCompany();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { entries, isLoading, totals, availableYears, deleteEntry, deleteYear, isDeleting } = useKPO(selectedCompany?.id || null, year);

  const years = availableYears.length > 0 ? availableYears : [currentYear];

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste videli KPO knjigu.</p>
      </div>
    );
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteEntry(entryId);
      toast.success('KPO unos obrisan');
    } catch (error) {
      toast.error('Greška pri brisanju unosa');
    }
  };

  const handleDeleteYear = async () => {
    try {
      await deleteYear({ companyId: selectedCompany.id, year });
      toast.success(`Obrisano ${entries.length} unosa za ${year}. godinu`);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Greška pri brisanju unosa');
    }
  };

  const handleCsvExport = () => {
    if (entries.length === 0) return;
    
    const headers = ['R.br.', 'Datum', 'Opis', 'Proizvodi (RSD)', 'Usluge (RSD)', 'Ukupno (RSD)'];
    const rows = entries.map(entry => [
      entry.display_ordinal,
      entry.document_date || '',
      `"${entry.description}"`,
      entry.products_amount.toString().replace('.', ','),
      entry.services_amount.toString().replace('.', ','),
      entry.total_amount.toString().replace('.', ','),
    ]);
    
    // Add totals row
    rows.push([
      '',
      '',
      '"UKUPNO"',
      totals.products.toString().replace('.', ','),
      totals.services.toString().replace('.', ','),
      totals.total.toString().replace('.', ','),
    ]);
    
    const csv = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KPO_${selectedCompany?.name}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = () => {
    if (entries.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formatCurrencyLocal = (amount: number) => {
      return new Intl.NumberFormat('sr-RS', {
        style: 'currency',
        currency: 'RSD',
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KPO Knjiga ${year}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .header { margin-bottom: 20px; }
          .company-info { color: #666; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .font-bold { font-weight: bold; }
          tfoot td { background-color: #f5f5f5; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>KPO KNJIGA - ${year}. GODINA</h1>
          <div class="company-info">
            <div><strong>${selectedCompany?.name}</strong></div>
            <div>PIB: ${selectedCompany?.pib}</div>
            <div>${selectedCompany?.address}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60px">R.br.</th>
              <th>Opis prometa</th>
              <th style="width: 120px" class="text-right">Proizvodi</th>
              <th style="width: 120px" class="text-right">Usluge</th>
              <th style="width: 120px" class="text-right">Ukupno</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(entry => `
              <tr>
                <td class="font-mono">${entry.display_ordinal}</td>
                <td>${entry.description}</td>
                <td class="text-right font-mono">${entry.products_amount > 0 ? formatCurrencyLocal(entry.products_amount) : '-'}</td>
                <td class="text-right font-mono">${entry.services_amount > 0 ? formatCurrencyLocal(entry.services_amount) : '-'}</td>
                <td class="text-right font-mono font-bold">${formatCurrencyLocal(entry.total_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">UKUPNO</td>
              <td class="text-right font-mono">${formatCurrencyLocal(totals.products)}</td>
              <td class="text-right font-mono">${formatCurrencyLocal(totals.services)}</td>
              <td class="text-right font-mono">${formatCurrencyLocal(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">KPO Knjiga</h1>
          <p className="text-muted-foreground">
            Knjiga o ostvarenom prometu za {selectedCompany.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}. godina
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Uvezi CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCsvExport} disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Izvezi CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handlePdfExport} disabled={entries.length === 0}>
                <FileText className="mr-2 h-4 w-4" />
                Izvezi PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => setDeleteDialogOpen(true)}
                disabled={entries.length === 0}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Obriši godinu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* CSV Import Dialog */}
      <KPOCsvImport 
        companyId={selectedCompany.id} 
        year={year}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {/* Delete Year Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati sve KPO unose za {year}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati {entries.length} unosa. Ovo se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteYear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši sve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Evidencija prometa - {year}. godina</CardTitle>
          <CardDescription>
            Automatski generisano na osnovu izdatih faktura
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nema unosa za {year}. godinu</p>
              <p className="text-muted-foreground">
                KPO unosi se automatski kreiraju kada izdate fakturu
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">R.br.</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right w-[150px]">Proizvodi</TableHead>
                    <TableHead className="text-right w-[150px]">Usluge</TableHead>
                    <TableHead className="text-right w-[150px]">Ukupno</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.display_ordinal}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.products_amount > 0 ? formatCurrency(entry.products_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.services_amount > 0 ? formatCurrency(entry.services_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(entry.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      UKUPNO
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(totals.products)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(totals.services)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-lg">
                      {formatCurrency(totals.total)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      {entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ukupno proizvodi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.products)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ukupno usluge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.services)}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-80">
                Ukupan promet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

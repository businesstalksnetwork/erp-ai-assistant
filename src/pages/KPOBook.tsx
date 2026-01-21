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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, Building2, Loader2, Trash2 } from 'lucide-react';
import { KPOPdfExport } from '@/components/KPOPdfExport';
import { KPOCsvExport } from '@/components/KPOCsvExport';
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
    } catch (error) {
      toast.error('Greška pri brisanju unosa');
    }
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
        <div className="flex items-center gap-2 flex-wrap">
          <KPOCsvImport companyId={selectedCompany.id} year={year} />
          <KPOPdfExport
            entries={entries}
            totals={totals}
            year={year}
            companyName={selectedCompany.name}
            companyPib={selectedCompany.pib}
            companyAddress={selectedCompany.address}
          />
          <KPOCsvExport
            entries={entries}
            totals={totals}
            year={year}
            companyName={selectedCompany.name}
          />
          
          {entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Obriši godinu
                </Button>
              </AlertDialogTrigger>
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
          )}
          
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
        </div>
      </div>

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

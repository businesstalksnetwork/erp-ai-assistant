import { useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useFiscalEntries } from '@/hooks/useFiscalEntries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Upload, Calculator, TrendingUp, TrendingDown, Trash2, List } from 'lucide-react';
import { FiscalImportDialog } from '@/components/FiscalImportDialog';
import { FiscalEntriesList } from '@/components/FiscalEntriesList';
import { FiscalDeleteByDateDialog } from '@/components/FiscalDeleteByDateDialog';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function FiscalCashRegister() {
  const { selectedCompany } = useSelectedCompany();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteByDateDialogOpen, setDeleteByDateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  
  const { entries, dailySummaries, isLoading, totals, availableYears } = useFiscalEntries(
    selectedCompany?.id || null,
    year
  );

  const years = availableYears.length > 0 ? availableYears : [currentYear];

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste videli fiskalne podatke.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fiskalna kasa</h1>
          <p className="text-muted-foreground">
            Evidencija prometa iz fiskalne kase za {selectedCompany.name}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Uvezi iz Excel-a
          </Button>
          <Button variant="outline" onClick={() => setDeleteByDateDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Brisanje po datumu
          </Button>
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupne prodaje</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.sales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupne refundacije</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{formatCurrency(totals.refunds)}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Neto promet</CardTitle>
            <Calculator className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Summary vs Entries List */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fiskalni podaci - {year}. godina</CardTitle>
                <CardDescription>
                  {activeTab === 'summary' 
                    ? 'Sumirani promet po danima (uključeno u KPO knjigu)' 
                    : 'Lista svih fiskalnih računa sa mogućnošću brisanja'}
                </CardDescription>
              </div>
              <TabsList>
                <TabsTrigger value="summary">
                  <Calculator className="h-4 w-4 mr-2" />
                  Dnevni zbir
                </TabsTrigger>
                <TabsTrigger value="entries">
                  <List className="h-4 w-4 mr-2" />
                  Računi ({entries.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="summary" className="mt-0">
                {dailySummaries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Nema fiskalnih podataka za {year}. godinu</p>
                    <p className="text-muted-foreground mb-4">
                      Uvezite Excel fajl iz fiskalne kase da biste započeli evidenciju
                    </p>
                    <Button onClick={() => setImportDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Uvezi iz Excel-a
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead className="text-right">Prodaje</TableHead>
                          <TableHead className="text-right">Refundacije</TableHead>
                          <TableHead className="text-right">Neto iznos</TableHead>
                          <TableHead className="text-center">KPO status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailySummaries.map((summary) => (
                          <TableRow key={summary.id}>
                            <TableCell className="font-medium">
                              {new Date(summary.summary_date).toLocaleDateString('sr-RS', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {formatCurrency(summary.sales_amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              -{formatCurrency(summary.refunds_amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatCurrency(summary.total_amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              {summary.kpo_entry_id ? (
                                <Badge variant="default" className="bg-green-500">
                                  U KPO knjizi
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Nije u KPO
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="entries" className="mt-0">
                <FiscalEntriesList 
                  entries={entries} 
                  companyId={selectedCompany.id} 
                  year={year}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <FiscalImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        companyId={selectedCompany.id}
      />

      {/* Delete by Date Dialog */}
      <FiscalDeleteByDateDialog
        open={deleteByDateDialogOpen}
        onOpenChange={setDeleteByDateDialogOpen}
        companyId={selectedCompany.id}
        year={year}
      />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileText, Plus, Trash2, Loader2, Building2, Search, ArrowRightLeft, Eye, RotateCcw } from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

type FilterType = 'all' | 'invoices' | 'proforma' | 'advance';

export default function Invoices() {
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading, deleteInvoice, convertProformaToInvoice, stornoInvoice } = useInvoices(selectedCompany?.id || null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [stornoId, setStornoId] = useState<string | null>(null);
  const [convertServiceDate, setConvertServiceDate] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client_name.toLowerCase().includes(search.toLowerCase());
    
    let matchesFilter = false;
    switch (filter) {
      case 'all':
        matchesFilter = true;
        break;
      case 'invoices':
        matchesFilter = inv.invoice_type === 'regular' || (!inv.is_proforma && inv.invoice_type !== 'advance');
        break;
      case 'proforma':
        matchesFilter = inv.invoice_type === 'proforma' || inv.is_proforma;
        break;
      case 'advance':
        matchesFilter = inv.invoice_type === 'advance';
        break;
    }
    
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async () => {
    if (deleteId) {
      await deleteInvoice.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleOpenConvert = (id: string) => {
    const proforma = invoices.find(i => i.id === id);
    setConvertServiceDate(proforma?.service_date || new Date().toISOString().split('T')[0]);
    setConvertId(id);
  };

  const handleConvert = async () => {
    if (convertId && convertServiceDate) {
      await convertProformaToInvoice.mutateAsync({ proformaId: convertId, serviceDate: convertServiceDate });
      setConvertId(null);
      setConvertServiceDate('');
    }
  };

  const handleStorno = async () => {
    if (!stornoId || !selectedCompany) return;
    
    const invoice = invoices.find(i => i.id === stornoId);
    if (!invoice) return;

    await stornoInvoice.mutateAsync(stornoId);
    setStornoId(null);
  };

  // Get invoice type badge
  const getTypeBadge = (invoice: typeof invoices[0]) => {
    if (invoice.invoice_type === 'advance') {
      return (
        <Badge variant={invoice.advance_status === 'closed' ? 'secondary' : 'default'} className={invoice.advance_status === 'open' ? 'bg-orange-500 text-white' : ''}>
          {invoice.advance_status === 'closed' ? 'Avans zatvoren' : 'Avansna'}
        </Badge>
      );
    }
    if (invoice.is_proforma || invoice.invoice_type === 'proforma') {
      return <Badge variant="outline">Predračun</Badge>;
    }
    return <Badge variant="default">Faktura</Badge>;
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste videli fakture.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fakture</h1>
          <p className="text-muted-foreground">Upravljajte fakturama, predračunima i avansnim fakturama</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              Nova faktura
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži po broju ili klijentu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve</SelectItem>
                <SelectItem value="invoices">Samo fakture</SelectItem>
                <SelectItem value="proforma">Samo predračuni</SelectItem>
                <SelectItem value="advance">Samo avansne</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nema faktura</p>
              <p className="text-muted-foreground mb-4">
                {search || filter !== 'all' ? 'Nema rezultata za vašu pretragu' : 'Kreirajte vašu prvu fakturu'}
              </p>
              {!search && filter === 'all' && (
                <Button asChild>
                  <Link to="/invoices/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova faktura
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{invoice.client_name}</p>
                          <Badge variant={invoice.client_type === 'domestic' ? 'default' : 'secondary'} className="mt-1">
                            {invoice.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(invoice.issue_date).toLocaleDateString('sr-RS')}</TableCell>
                      <TableCell>
                        {getTypeBadge(invoice)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(invoice.total_amount)}
                        {invoice.foreign_currency && (
                          <p className="text-xs text-muted-foreground">
                            {invoice.foreign_amount} {invoice.foreign_currency}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <Link to={`/invoices/${invoice.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {/* Storno Button - for regular invoices only */}
                          {invoice.invoice_type === 'regular' && !invoice.is_proforma && invoice.total_amount > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setStornoId(invoice.id)}
                                    disabled={stornoInvoice.isPending}
                                    title="Storniraj fakturu"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Storniraj fakturu</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {(invoice.is_proforma || invoice.invoice_type === 'proforma') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenConvert(invoice.id)}
                              title="Pretvori u fakturu"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(invoice.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši fakturu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati fakturu i povezani KPO unos. Ovo se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Dialog */}
      <Dialog open={!!convertId} onOpenChange={() => { setConvertId(null); setConvertServiceDate(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pretvori u fakturu</DialogTitle>
            <DialogDescription>
              Izaberite datum prometa za novu fakturu. Predračun će ostati sačuvan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="serviceDate">Datum prometa</Label>
            <Input
              id="serviceDate"
              type="date"
              value={convertServiceDate}
              onChange={(e) => setConvertServiceDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConvertId(null); setConvertServiceDate(''); }}>
              Otkaži
            </Button>
            <Button onClick={handleConvert} disabled={!convertServiceDate || convertProformaToInvoice.isPending}>
              {convertProformaToInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pretvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storno Dialog */}
      <AlertDialog open={!!stornoId} onOpenChange={() => setStornoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Storniraj fakturu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će kreirati storno fakturu sa svim stavkama u minusu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStorno}
              disabled={stornoInvoice.isPending}
            >
              {stornoInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Storniraj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

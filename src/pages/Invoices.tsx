import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useSEF } from '@/hooks/useSEF';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { FileText, Plus, Trash2, Loader2, Building2, Search, ArrowRightLeft, Eye, RotateCcw, Banknote, Pencil } from 'lucide-react';
import { PaymentStatusDialog } from '@/components/PaymentStatusDialog';
import { TemplatesDropdown } from '@/components/TemplatesDropdown';

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
  const { invoices, isLoading, deleteInvoice, convertProformaToInvoice, stornoInvoice, updatePaymentStatus } = useInvoices(selectedCompany?.id || null);
  const { sendToSEF, sendStornoToSEF } = useSEF();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [stornoId, setStornoId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<typeof invoices[0] | null>(null);
  const [convertServiceDate, setConvertServiceDate] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
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
  }, [invoices, search, filter]);

  // Sort by date (newest first) and paginate
  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => 
      new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
    );
  }, [filteredInvoices]);

  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = sortedInvoices.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: FilterType) => {
    setFilter(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

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
    if (convertId && convertServiceDate && selectedCompany) {
      const proforma = invoices.find(i => i.id === convertId);
      const result = await convertProformaToInvoice.mutateAsync({ proformaId: convertId, serviceDate: convertServiceDate });
      
      // Automatski pošalji na SEF ako su ispunjeni uslovi
      if (
        selectedCompany.sef_enabled && 
        selectedCompany.has_sef_api_key && 
        proforma?.client_type === 'domestic' &&
        result?.id
      ) {
        sendToSEF(result.id, selectedCompany.id, { silent: false }).then(sefResult => {
          if (!sefResult.success) {
            console.error('SEF auto-send failed:', sefResult.error);
          }
        });
      }
      
      setConvertId(null);
      setConvertServiceDate('');
    }
  };

  const handleStorno = async () => {
    if (!stornoId || !selectedCompany) return;
    
    const invoice = invoices.find(i => i.id === stornoId);
    if (!invoice) return;

    const result = await stornoInvoice.mutateAsync(stornoId);
    
    // Automatski storniraj na SEF-u ako je originalna faktura bila na SEF-u
    if (
      selectedCompany.sef_enabled && 
      selectedCompany.has_sef_api_key && 
      invoice.sef_invoice_id &&
      invoice.client_type === 'domestic' &&
      result?.stornoInvoice?.id
    ) {
      sendStornoToSEF(result.stornoInvoice.id, selectedCompany.id, invoice.sef_invoice_id, { silent: false }).then(sefResult => {
        if (!sefResult.success) {
          console.error('SEF storno auto-send failed:', sefResult.error);
        }
      });
    }
    
    setStornoId(null);
  };

  // Find if a proforma has been converted to an invoice
  const getCreatedInvoiceFromProforma = (proformaId: string) => {
    return invoices.find(i => i.converted_from_proforma === proformaId);
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
      const createdInvoice = getCreatedInvoiceFromProforma(invoice.id);
      return (
        <div className="space-y-1">
          <Badge variant="outline">Predračun</Badge>
          {createdInvoice && (
            <Link to={`/invoices/${createdInvoice.id}`} className="block">
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                ↳ Kreirana faktura {createdInvoice.invoice_number}
              </Badge>
            </Link>
          )}
        </div>
      );
    }
    return <Badge variant="default">Faktura</Badge>;
  };

  // Get payment status badge for regular invoices
  const getPaymentStatusBadge = (invoice: typeof invoices[0]) => {
    // Only show for regular invoices
    if (invoice.invoice_type !== 'regular' || invoice.is_proforma) return null;

    switch (invoice.payment_status) {
      case 'paid':
        return <Badge className="bg-green-500 hover:bg-green-600">Plaćeno</Badge>;
      case 'partial':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            Delimično ({formatCurrency(invoice.paid_amount || 0)})
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-muted-foreground">Neplaćeno</Badge>;
    }
  };

  // Handle payment status save
  const handleSavePaymentStatus = async (data: {
    invoiceId: string;
    payment_status: 'unpaid' | 'partial' | 'paid';
    paid_amount?: number;
    payment_date?: string;
  }) => {
    await updatePaymentStatus.mutateAsync(data);
    setPaymentInvoice(null);
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
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Fakture</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Upravljajte fakturama i predračunima</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <TemplatesDropdown companyId={selectedCompany?.id || null} />
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              Nova faktura
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v: FilterType) => handleFilterChange(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve</SelectItem>
                <SelectItem value="invoices">Fakture</SelectItem>
                <SelectItem value="proforma">Predračuni</SelectItem>
                <SelectItem value="advance">Avansne</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nema faktura</p>
              <p className="text-muted-foreground mb-4 text-sm text-center">
                {search || filter !== 'all' ? 'Nema rezultata za vašu pretragu' : 'Kreirajte vašu prvu fakturu'}
              </p>
              {!search && filter === 'all' && (
                <Button asChild size="sm">
                  <Link to="/invoices/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova faktura
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broj</TableHead>
                      <TableHead>Klijent</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Iznos</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((invoice) => (
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
                        <TableCell>
                          {getPaymentStatusBadge(invoice)}
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
                            {(() => {
                              const isProforma = invoice.is_proforma || invoice.invoice_type === 'proforma';
                              const isAdvance = invoice.invoice_type === 'advance';
                              const isRegular = invoice.invoice_type === 'regular' && !invoice.is_proforma;
                              const proformaConverted = isProforma && getCreatedInvoiceFromProforma(invoice.id);
                              const advanceClosed = isAdvance && invoice.advance_status === 'closed';
                              const canEdit = isRegular || (isProforma && !proformaConverted) || (isAdvance && !advanceClosed);
                              if (!canEdit) return null;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="icon" variant="ghost" asChild>
                                        <Link to={`/invoices/${invoice.id}/edit`}>
                                          <Pencil className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Izmeni</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            {invoice.invoice_type === 'regular' && !invoice.is_proforma && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" onClick={() => setPaymentInvoice(invoice)}>
                                      <Banknote className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Označi plaćanje</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {invoice.invoice_type === 'regular' && !invoice.is_proforma && invoice.total_amount > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" onClick={() => setStornoId(invoice.id)} disabled={stornoInvoice.isPending}>
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Storniraj</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {(invoice.is_proforma || invoice.invoice_type === 'proforma') && !getCreatedInvoiceFromProforma(invoice.id) && (
                              <Button size="icon" variant="ghost" onClick={() => handleOpenConvert(invoice.id)} title="Pretvori u fakturu">
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(invoice.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {paginatedInvoices.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-3 space-y-2 bg-secondary/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{invoice.client_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(invoice.total_amount)}</p>
                        {invoice.foreign_currency && (
                          <p className="text-[10px] text-muted-foreground">{invoice.foreign_amount} {invoice.foreign_currency}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {getTypeBadge(invoice)}
                        {getPaymentStatusBadge(invoice)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{new Date(invoice.issue_date).toLocaleDateString('sr-RS')}</p>
                    </div>
                    <div className="flex justify-end gap-1 pt-1 border-t">
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <Link to={`/invoices/${invoice.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      {(() => {
                        const isProforma = invoice.is_proforma || invoice.invoice_type === 'proforma';
                        const isAdvance = invoice.invoice_type === 'advance';
                        const isRegular = invoice.invoice_type === 'regular' && !invoice.is_proforma;
                        const proformaConverted = isProforma && getCreatedInvoiceFromProforma(invoice.id);
                        const advanceClosed = isAdvance && invoice.advance_status === 'closed';
                        const canEdit = isRegular || (isProforma && !proformaConverted) || (isAdvance && !advanceClosed);
                        if (!canEdit) return null;
                        return (
                          <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                            <Link to={`/invoices/${invoice.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                        );
                      })()}
                      {invoice.invoice_type === 'regular' && !invoice.is_proforma && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPaymentInvoice(invoice)}>
                          <Banknote className="h-4 w-4" />
                        </Button>
                      )}
                      {(invoice.is_proforma || invoice.invoice_type === 'proforma') && !getCreatedInvoiceFromProforma(invoice.id) && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenConvert(invoice.id)}>
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteId(invoice.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {sortedInvoices.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Prikaži:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      od {sortedInvoices.length}
                    </span>
                  </div>
                  
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {getPageNumbers().map((page, idx) => (
                          <PaginationItem key={idx}>
                            {page === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </>
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
            <DateInput
              id="serviceDate"
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

      {/* Payment Status Dialog */}
      <PaymentStatusDialog
        open={!!paymentInvoice}
        onOpenChange={(open) => !open && setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSave={handleSavePaymentStatus}
        isLoading={updatePaymentStatus.isPending}
      />
    </div>
  );
}

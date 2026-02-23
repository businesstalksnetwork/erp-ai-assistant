import { useState, useEffect } from 'react';
import { useSEFImport, SEFInvoice } from '@/hooks/useSEFImport';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Download, Search, CheckCircle2, AlertCircle } from 'lucide-react';

interface SEFImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('sr-RS');
}

export function SEFImportDialog({ open, onOpenChange, companyId }: SEFImportDialogProps) {
  const { fetchSEFInvoices, importMultipleSEFInvoices, isFetching, isImporting } = useSEFImport();
  
  const [invoices, setInvoices] = useState<SEFInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasFetched, setHasFetched] = useState(false);
  const [stats, setStats] = useState<{ totalFound: number; alreadyImported: number } | null>(null);
  
  // Date range - default to current year
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setInvoices([]);
      setSelectedIds(new Set());
      setHasFetched(false);
      setStats(null);
    }
  }, [open]);

  const handleFetch = async () => {
    const result = await fetchSEFInvoices(companyId, dateFrom, dateTo);
    
    if (result.success) {
      setInvoices(result.invoices);
      setStats({
        totalFound: result.totalFound || 0,
        alreadyImported: result.alreadyImported || 0,
      });
      setHasFetched(true);
    }
  };

  const handleToggleSelect = (invoiceId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map(inv => inv.invoiceId)));
    }
  };

  const handleImport = async () => {
    const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.invoiceId));
    
    if (selectedInvoices.length === 0) return;

    const result = await importMultipleSEFInvoices(selectedInvoices, companyId);
    
    if (result.success > 0) {
      // Remove imported invoices from the list
      setInvoices(prev => prev.filter(inv => !selectedIds.has(inv.invoiceId)));
      setSelectedIds(new Set());
      
      // If all imported, close dialog
      if (result.success === selectedInvoices.length) {
        onOpenChange(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'Sent': { label: 'Poslato', variant: 'default' },
      'Approved': { label: 'Odobreno', variant: 'default' },
      'Seen': { label: 'Viđeno', variant: 'secondary' },
      'Rejected': { label: 'Odbijeno', variant: 'destructive' },
      'Storno': { label: 'Storno', variant: 'outline' },
      'Cancelled': { label: 'Poništeno', variant: 'destructive' },
    };
    
    return statusMap[status] || { label: status, variant: 'outline' as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Povuci fakture sa SEF-a
          </DialogTitle>
          <DialogDescription>
            Izaberite period i preuzmite fakture koje ste poslali putem SEF sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Date range selector */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="dateFrom">Od datuma</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="dateTo">Do datuma</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={handleFetch} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Pretraži SEF
            </Button>
          </div>

          {/* Stats info */}
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Već uvezeno: {stats.alreadyImported}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Za uvoz: {invoices.length}
              </div>
            </div>
          )}

          {/* Invoice list */}
          {hasFetched && (
            <ScrollArea className="flex-1 border rounded-md">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                  <p className="text-lg font-medium">Sve fakture su već uvezene</p>
                  <p className="text-sm">Nema novih faktura za uvoz u odabranom periodu.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === invoices.length && invoices.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Broj fakture</TableHead>
                      <TableHead>Kupac</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Iznos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.invoiceId}
                        className="cursor-pointer"
                        onClick={() => handleToggleSelect(invoice.invoiceId)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(invoice.invoiceId)}
                            onCheckedChange={() => handleToggleSelect(invoice.invoiceId)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p>{invoice.buyerName}</p>
                            {invoice.buyerPib && (
                              <p className="text-xs text-muted-foreground">PIB: {invoice.buyerPib}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadge(invoice.status).variant}>
                            {getStatusBadge(invoice.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          )}

          {!hasFetched && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
              <Download className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Pretražite SEF</p>
              <p className="text-sm">Izaberite period i kliknite "Pretraži SEF" da vidite dostupne fakture.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Uvezi {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

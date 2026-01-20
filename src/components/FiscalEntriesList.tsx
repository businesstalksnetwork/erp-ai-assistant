import { useState } from 'react';
import { FiscalEntry, useFiscalEntries } from '@/hooks/useFiscalEntries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2, Loader2, Home, Globe, ChevronDown } from 'lucide-react';

interface FiscalEntriesListProps {
  entries: FiscalEntry[];
  companyId: string;
  year: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function FiscalEntriesList({ entries, companyId, year }: FiscalEntriesListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk'>('single');
  const [entryToDelete, setEntryToDelete] = useState<FiscalEntry | null>(null);

  const { deleteFiscalEntry, deleteFiscalEntries, updateFiscalEntryForeign } = useFiscalEntries(companyId, year);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(entries.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectEntry = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSingle = (entry: FiscalEntry) => {
    setEntryToDelete(entry);
    setDeleteMode('single');
    setDeleteDialogOpen(true);
  };

  const handleDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    setDeleteMode('bulk');
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteMode === 'single' && entryToDelete) {
      await deleteFiscalEntry.mutateAsync({
        entryId: entryToDelete.id,
        companyId,
        entryDate: entryToDelete.entry_date,
      });
    } else if (deleteMode === 'bulk') {
      await deleteFiscalEntries.mutateAsync({
        entryIds: Array.from(selectedIds),
        companyId,
      });
      setSelectedIds(new Set());
    }
    setDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const handleToggleForeign = async (entry: FiscalEntry) => {
    await updateFiscalEntryForeign.mutateAsync({
      entryId: entry.id,
      companyId,
      entryDate: entry.entry_date,
      isForeign: !entry.is_foreign,
    });
  };

  const isDeleting = deleteFiscalEntry.isPending || deleteFiscalEntries.isPending;
  const isUpdating = updateFiscalEntryForeign.isPending;
  const allSelected = entries.length > 0 && selectedIds.size === entries.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < entries.length;

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nema fiskalnih računa za prikaz
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <span className="text-sm font-medium">
            Izabrano: {selectedIds.size} računa
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteBulk}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Obriši izabrane
          </Button>
        </div>
      )}

      <ScrollArea className="h-[400px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = someSelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Broj računa</TableHead>
              <TableHead>Poslovni prostor</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Promet</TableHead>
              <TableHead className="text-right">Iznos</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(entry.id)}
                    onCheckedChange={(checked) => handleSelectEntry(entry.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
                  {new Date(entry.entry_date).toLocaleDateString('sr-RS')}
                </TableCell>
                <TableCell className="font-mono text-sm">{entry.receipt_number}</TableCell>
                <TableCell className="max-w-[200px] truncate">{entry.business_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={entry.transaction_type === 'Продаја' ? 'default' : 'destructive'}>
                    {entry.transaction_type === 'Продаја' ? 'Prodaja' : 'Refundacija'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 gap-1"
                        disabled={isUpdating}
                      >
                        {entry.is_foreign ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <Globe className="h-3 w-3 mr-1" />
                            Strani
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <Home className="h-3 w-3 mr-1" />
                            Domaći
                          </Badge>
                        )}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem 
                        onClick={() => !entry.is_foreign || handleToggleForeign(entry)}
                        className={!entry.is_foreign ? 'bg-accent' : ''}
                      >
                        <Home className="h-4 w-4 mr-2" />
                        Domaći promet
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => entry.is_foreign || handleToggleForeign(entry)}
                        className={entry.is_foreign ? 'bg-accent' : ''}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Strani promet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className={`text-right font-mono ${entry.transaction_type === 'Рефундација' ? 'text-red-600' : ''}`}>
                  {entry.transaction_type === 'Рефундација' ? '-' : ''}{formatCurrency(Math.abs(entry.amount))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteSingle(entry)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'single' && entryToDelete ? (
                <>
                  Da li ste sigurni da želite da obrišete račun <strong>{entryToDelete.receipt_number}</strong> od{' '}
                  {new Date(entryToDelete.entry_date).toLocaleDateString('sr-RS')}?
                  <br /><br />
                  Dnevni zbir i KPO unos će biti automatski ažurirani.
                </>
              ) : (
                <>
                  Da li ste sigurni da želite da obrišete <strong>{selectedIds.size}</strong> izabranih računa?
                  <br /><br />
                  Dnevni zbiri i KPO unosi će biti automatski ažurirani.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Brisanje...
                </>
              ) : (
                'Obriši'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

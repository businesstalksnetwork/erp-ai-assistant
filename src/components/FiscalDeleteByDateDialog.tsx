import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CalendarIcon, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { useFiscalEntries } from '@/hooks/useFiscalEntries';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FiscalDeleteByDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  year: number;
}

export function FiscalDeleteByDateDialog({
  open,
  onOpenChange,
  companyId,
  year,
}: FiscalDeleteByDateDialogProps) {
  const [deleteType, setDeleteType] = useState<'single' | 'range' | 'year'>('single');
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { 
    entries,
    dailySummaries,
    deleteFiscalEntriesByDate, 
    deleteFiscalEntriesByDateRange,
    deleteFiscalEntriesByYear 
  } = useFiscalEntries(companyId, year);

  const isDeleting = deleteFiscalEntriesByDate.isPending || 
    deleteFiscalEntriesByDateRange.isPending || 
    deleteFiscalEntriesByYear.isPending;

  const canDelete = deleteType === 'single' 
    ? !!singleDate 
    : deleteType === 'range'
    ? !!startDate && !!endDate
    : true; // 'year' type always enabled

  const handleDelete = async () => {
    if (deleteType === 'single' && singleDate) {
      await deleteFiscalEntriesByDate.mutateAsync({
        companyId,
        date: format(singleDate, 'yyyy-MM-dd'),
      });
    } else if (deleteType === 'range' && startDate && endDate) {
      await deleteFiscalEntriesByDateRange.mutateAsync({
        companyId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    } else if (deleteType === 'year') {
      await deleteFiscalEntriesByYear.mutateAsync({
        companyId,
        year,
      });
    }
    
    // Reset form
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Brisanje po datumu
          </DialogTitle>
          <DialogDescription>
            Obrišite sve fiskalne račune za izabrani datum ili period.
            Dnevni zbiri i KPO unosi će biti automatski ažurirani.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={deleteType} onValueChange={(v) => setDeleteType(v as 'single' | 'range' | 'year')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single">Jedan dan</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="range" id="range" />
              <Label htmlFor="range">Period (od-do)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="year" id="year" />
              <Label htmlFor="year" className="font-medium text-destructive">
                Cela godina ({year})
              </Label>
            </div>
          </RadioGroup>

          {deleteType === 'single' && (
            <div className="space-y-2">
              <Label>Izaberite datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !singleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {singleDate ? format(singleDate, 'dd.MM.yyyy', { locale: sr }) : 'Izaberite datum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={singleDate}
                    onSelect={setSingleDate}
                    initialFocus
                    locale={sr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {deleteType === 'range' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Od datuma</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd.MM.yyyy', { locale: sr }) : 'Početni datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={sr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Do datuma</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd.MM.yyyy', { locale: sr }) : 'Krajnji datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={sr}
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
              </Popover>
              </div>
            </div>
          )}

          {deleteType === 'year' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Upozorenje:</strong> Ovo će obrisati sve fiskalne račune za {year}. godinu 
                ({entries.length} računa, {dailySummaries.length} dnevnih suma i povezane KPO unose).
                Ova akcija se ne može poništiti!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Otkaži
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={!canDelete || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Brisanje...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Obriši
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

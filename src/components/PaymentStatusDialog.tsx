import { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PaymentStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
    payment_status?: string;
    paid_amount?: number;
    payment_date?: string;
  } | null;
  onSave: (data: {
    invoiceId: string;
    payment_status: 'unpaid' | 'partial' | 'paid';
    paid_amount?: number;
    payment_date?: string;
  }) => void;
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export function PaymentStatusDialog({
  open,
  onOpenChange,
  invoice,
  onSave,
  isLoading,
}: PaymentStatusDialogProps) {
  const [status, setStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (invoice) {
      setStatus((invoice.payment_status as 'unpaid' | 'partial' | 'paid') || 'unpaid');
      setPaidAmount(invoice.paid_amount?.toString() || '');
      setPaymentDate(invoice.payment_date || new Date().toISOString().split('T')[0]);
    }
  }, [invoice]);

  const handleSave = () => {
    if (!invoice) return;

    onSave({
      invoiceId: invoice.id,
      payment_status: status,
      paid_amount: status === 'partial' ? parseFloat(paidAmount) : undefined,
      payment_date: status !== 'unpaid' ? paymentDate : undefined,
    });
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Označi plaćanje</DialogTitle>
          <DialogDescription>
            Faktura: {invoice.invoice_number}
            <br />
            Iznos: {formatCurrency(invoice.total_amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="unpaid" id="unpaid" />
              <Label htmlFor="unpaid">Neplaćeno</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partial" id="partial" />
              <Label htmlFor="partial">Delimično plaćeno</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="paid" id="paid" />
              <Label htmlFor="paid">Plaćeno u celosti</Label>
            </div>
          </RadioGroup>

          {status === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="paidAmount">Uplaćeni iznos (RSD)</Label>
              <Input
                id="paidAmount"
                type="number"
                step="0.01"
                min="0"
                max={invoice.total_amount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Unesite iznos"
              />
              <p className="text-xs text-muted-foreground">
                Preostalo: {formatCurrency(invoice.total_amount - (parseFloat(paidAmount) || 0))}
              </p>
            </div>
          )}

          {status !== 'unpaid' && (
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Datum uplate</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Čuvanje...' : 'Sačuvaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

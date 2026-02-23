import { useState } from 'react';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Copy, Check, QrCode, CreditCard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { BookkeeperPayout } from '@/hooks/useBookkeeperPayouts';

interface PayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payout: BookkeeperPayout | null;
  onMarkAsPaid: () => void;
  isMarking: boolean;
}

// Format account for IPS QR Code
function formatAccountForIPS(account: string): string {
  const cleaned = account.replace(/[^0-9]/g, '');
  return cleaned.padEnd(18, '0');
}

// Generate IPS QR Code string
function generateIPSQRCode(
  recipientName: string,
  recipientAccount: string,
  amount: number,
  purpose: string,
  payerName: string = 'ERP-AI DOO'
): string {
  const formattedAccount = formatAccountForIPS(recipientAccount);
  const amountStr = `RSD${amount.toFixed(2).replace('.', ',')}`;
  
  const lines = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${formattedAccount}`,
    `N:${recipientName.substring(0, 70)}`,
    `I:${amountStr}`,
    'SF:221',
    `S:${purpose.substring(0, 35)}`,
  ];
  
  return lines.join('\n');
}

export function PayoutDialog({ open, onOpenChange, payout, onMarkAsPaid, isMarking }: PayoutDialogProps) {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!payout) return null;

  const hasCompleteData = payout.bookkeeper_company_name && payout.bookkeeper_pib && payout.bookkeeper_bank_account;
  
  const paymentData = {
    primalac: payout.bookkeeper_company_name || 'Nije popunjeno',
    pib: payout.bookkeeper_pib || 'Nije popunjeno',
    racun: payout.bookkeeper_bank_account || 'Nije popunjeno',
    adresa: payout.bookkeeper_address || '',
    iznos: payout.pending_amount,
    sifra: '221',
    svrha: `Provizija ERP-AI - ${format(new Date(), 'MMMM yyyy', { locale: sr })}`,
  };

  const copyPaymentData = () => {
    const text = `Primalac: ${paymentData.primalac}
PIB: ${paymentData.pib}
Račun: ${paymentData.racun}
${paymentData.adresa ? `Adresa: ${paymentData.adresa}\n` : ''}Iznos: ${paymentData.iznos.toLocaleString('sr-RS')},00 RSD
Šifra plaćanja: ${paymentData.sifra}
Svrha: ${paymentData.svrha}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Kopirano', description: 'Podaci za plaćanje su kopirani.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Nalog za isplatu
          </DialogTitle>
          <DialogDescription>
            {payout.bookkeeper_name || payout.bookkeeper_email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasCompleteData && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              ⚠️ Knjigovođa nije popunio podatke o firmi. Kontaktirajte ga da popuni profil.
            </div>
          )}

          {/* Payment Details */}
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Primalac:</span>
            <span className="font-medium">{paymentData.primalac}</span>
            
            <span className="text-muted-foreground">PIB:</span>
            <span className="font-mono">{paymentData.pib}</span>
            
            <span className="text-muted-foreground">Račun:</span>
            <span className="font-mono">{paymentData.racun}</span>
            
            {paymentData.adresa && (
              <>
                <span className="text-muted-foreground">Adresa:</span>
                <span>{paymentData.adresa}</span>
              </>
            )}
            
            <span className="text-muted-foreground">Iznos:</span>
            <span className="font-bold text-lg text-primary">
              {paymentData.iznos.toLocaleString('sr-RS')},00 RSD
            </span>
            
            <span className="text-muted-foreground">Šifra plaćanja:</span>
            <span className="font-mono">{paymentData.sifra}</span>
            
            <span className="text-muted-foreground">Svrha:</span>
            <span>{paymentData.svrha}</span>
          </div>

          <Separator />

          {/* Earnings breakdown */}
          <div>
            <p className="text-sm font-medium mb-2">Stavke ({payout.pending_earnings.length})</p>
            <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
              {payout.pending_earnings.map((earning) => (
                <div key={earning.id} className="flex justify-between text-muted-foreground">
                  <span>{earning.client_name || earning.client_email}</span>
                  <span className="font-mono">{earning.commission_amount.toLocaleString('sr-RS')} RSD</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          {showQR && hasCompleteData && (
            <>
              <Separator />
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={generateIPSQRCode(
                      paymentData.primalac,
                      paymentData.racun,
                      paymentData.iznos,
                      paymentData.svrha
                    )}
                    size={160}
                    level="L"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={copyPaymentData} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Kopiraj podatke
          </Button>
          
          {hasCompleteData && (
            <Button variant="outline" onClick={() => setShowQR(!showQR)} className="gap-2">
              <QrCode className="h-4 w-4" />
              {showQR ? 'Sakrij QR' : 'Prikaži QR'}
            </Button>
          )}
          
          <Button onClick={onMarkAsPaid} disabled={isMarking} className="gap-2">
            <Check className="h-4 w-4" />
            {isMarking ? 'Označavam...' : 'Označi kao plaćeno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

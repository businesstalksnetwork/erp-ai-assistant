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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Globe } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useInvoiceEmail } from '@/hooks/useInvoiceEmail';

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  clientEmail?: string | null;
  clientType: 'domestic' | 'foreign';
  totalAmount: string;
  issueDate: string;
  paymentDeadline?: string;
  generatePdfBlob: () => Promise<Blob>;
  userEmail?: string;
  signatureSr?: string | null;
  signatureEn?: string | null;
}

const translations = {
  sr: {
    greeting: 'Poštovani,',
    body: 'U prilogu se nalazi faktura broj',
    signoff: 'S poštovanjem,',
  },
  en: {
    greeting: 'Dear Client,',
    body: 'Please find attached invoice number',
    signoff: 'Best regards,',
  },
};

export function SendInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  companyId,
  companyName,
  clientEmail,
  clientType,
  totalAmount,
  issueDate,
  paymentDeadline,
  generatePdfBlob,
  userEmail,
  signatureSr,
  signatureEn,
}: SendInvoiceDialogProps) {
  const { sendInvoiceEmail } = useInvoiceEmail();
  const [email, setEmail] = useState(clientEmail || '');
  const [language, setLanguage] = useState<'sr' | 'en'>(clientType === 'foreign' ? 'en' : 'sr');
  const [ccToSender, setCcToSender] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Update email when dialog opens or clientEmail changes
  useEffect(() => {
    if (open) {
      setEmail(clientEmail || '');
      setLanguage(clientType === 'foreign' ? 'en' : 'sr');
    }
  }, [open, clientEmail, clientType]);

  const t = translations[language];

  const handleSend = async () => {
    if (!email) return;

    setIsGenerating(true);
    try {
      // Generate PDF blob
      const pdfBlob = await generatePdfBlob();

      // Send email
      await sendInvoiceEmail.mutateAsync({
        invoiceId,
        companyId,
        recipientEmail: email,
        language,
        pdfBlob,
        ccToSender,
        senderEmail: userEmail,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error sending invoice email:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const isLoading = isGenerating || sendInvoiceEmail.isPending;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pošalji fakturu emailom
          </DialogTitle>
          <DialogDescription>
            Faktura {invoiceNumber} će biti poslata kao PDF prilog
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email primaoca</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className={!isValidEmail && email ? 'border-destructive' : ''}
            />
            {!isValidEmail && email && (
              <p className="text-xs text-destructive">Unesite validnu email adresu</p>
            )}
          </div>

          {/* Language select */}
          <div className="space-y-2">
            <Label htmlFor="language">Jezik emaila</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'sr' | 'en')}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sr">
                  <div className="flex items-center gap-2">
                    <span>🇷🇸</span>
                    <span>Srpski</span>
                  </div>
                </SelectItem>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    <span>🇬🇧</span>
                    <span>English</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {clientType === 'foreign' 
                ? 'Automatski predložen engleski za stranog klijenta' 
                : 'Automatski predložen srpski za domaćeg klijenta'}
            </p>
          </div>

          {/* CC checkbox */}
          {userEmail && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cc"
                checked={ccToSender}
                onCheckedChange={(checked) => setCcToSender(checked === true)}
              />
              <Label htmlFor="cc" className="text-sm font-normal cursor-pointer">
                Pošalji kopiju na moj email ({userEmail})
              </Label>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Pregled emaila
            </Label>
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm space-y-3">
                <p className="font-medium">{t.greeting}</p>
                <p>
                  {t.body} <strong>{invoiceNumber}</strong>.
                </p>
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    {language === 'sr' ? 'Datum izdavanja:' : 'Issue date:'}{' '}
                    <strong className="text-foreground">{issueDate}</strong>
                  </p>
                  {paymentDeadline && (
                    <p>
                      {language === 'sr' ? 'Rok plaćanja:' : 'Payment due:'}{' '}
                      <strong className="text-foreground">{paymentDeadline}</strong>
                    </p>
                  )}
                  <p>
                    {language === 'sr' ? 'Iznos:' : 'Amount:'}{' '}
                    <strong className="text-foreground">{totalAmount}</strong>
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground">{t.signoff}</p>
                  <p className="font-medium">{companyName}</p>
                  {(language === 'sr' ? signatureSr : signatureEn) && (
                    <div 
                      className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize((language === 'sr' ? signatureSr : signatureEn) || '', {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'span'],
                          ALLOWED_ATTR: ['href', 'target', 'rel'],
                        })
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Otkaži
          </Button>
          <Button onClick={handleSend} disabled={isLoading || !isValidEmail}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isGenerating ? 'Generisanje PDF-a...' : 'Slanje...'}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Pošalji
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

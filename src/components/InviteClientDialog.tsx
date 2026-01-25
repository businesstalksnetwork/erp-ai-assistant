import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getProductionUrl } from '@/lib/domain';
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
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Mail, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteClientDialog({ open, onOpenChange }: InviteClientDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const referralLink = user?.id 
    ? `${getProductionUrl()}/auth?ref=${user.id}` 
    : '';

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: 'Link kopiran',
      description: 'Referral link je kopiran u clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!email) {
      toast({
        title: 'Greška',
        description: 'Unesite email adresu.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    
    // For now, just open the email client with a pre-filled message
    const subject = encodeURIComponent('Poziv za PaušalBox aplikaciju');
    const body = encodeURIComponent(
      `Zdravo,\n\nPozivam te da koristiš PaušalBox - aplikaciju za preduzetnike paušalce.\n\nRegistruj se preko ovog linka: ${referralLink}\n\nPozdrav`
    );
    
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    
    toast({
      title: 'Email klijent otvoren',
      description: 'Email sa pozivnicom je pripremljen za slanje.',
    });
    
    setSending(false);
    setEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pozovi klijenta</DialogTitle>
          <DialogDescription>
            Pozovite klijenta da koristi PaušalBox. Kada se registruje i plati pretplatu, 
            dobićete 20% provizije.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Vaš referral link</Label>
              <div className="flex gap-2">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Kopirajte link i podelite ga sa potencijalnim klijentima putem 
                poruke, društvenih mreža ili bilo kog drugog kanala.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="client-email">Email adresa klijenta</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="klijent@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Otvoriće se vaš email klijent sa pripremljenom pozivnicom.
              </p>
            </div>
            <Button 
              onClick={handleSendEmail} 
              disabled={sending || !email}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Otvori email
            </Button>
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Kako funkcioniše?</p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li>1. Podelite link sa klijentom</li>
            <li>2. Klijent se registruje i dobija 7 dana probnog perioda</li>
            <li>3. Kada klijent plati pretplatu, vi dobijate 20% provizije</li>
            <li>4. Zarada se automatski obračunava na kraju meseca</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

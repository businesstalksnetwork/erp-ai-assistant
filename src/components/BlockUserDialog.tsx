import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ban } from 'lucide-react';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  onBlock: (userId: string, reason: string) => void;
}

export function BlockUserDialog({
  open,
  onOpenChange,
  user,
  onBlock,
}: BlockUserDialogProps) {
  const [reason, setReason] = useState('');

  if (!user) return null;

  const handleBlock = () => {
    if (reason.trim()) {
      onBlock(user.id, reason.trim());
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Blokiraj korisnika
          </DialogTitle>
          <DialogDescription>
            Korisnik neće moći da koristi aplikaciju dok ne bude odblokiran.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-reason">Razlog blokiranja *</Label>
            <Textarea
              id="block-reason"
              placeholder="Npr. Istekla pretplata - potrebno je obnoviti pretplatu za nastavak korišćenja."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Ovaj razlog će biti prikazan korisniku.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button
            variant="destructive"
            onClick={handleBlock}
            disabled={!reason.trim()}
          >
            Blokiraj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

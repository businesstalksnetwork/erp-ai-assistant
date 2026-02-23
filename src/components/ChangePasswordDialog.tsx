import { useState } from 'react';
import { z } from 'zod';
import { KeyRound, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const passwordSchema = z.string().min(6, 'Lozinka mora imati najmanje 6 karaktera');

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function ChangePasswordDialog({
  buttonClassName,
  asDropdownItem = false,
}: {
  buttonClassName?: string;
  asDropdownItem?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<{
    currentPassword?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const resetForm = () => {
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = user?.email;
    if (!email) {
      toast({
        title: 'Greška',
        description: 'Nije moguće promeniti lozinku: nedostaje email korisnika.',
        variant: 'destructive',
      });
      return;
    }

    const nextErrors: typeof errors = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Unesite trenutnu lozinku';
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      nextErrors.password = passwordResult.error.errors[0].message;
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Lozinke se ne poklapaju';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      // Re-authenticate (prevents "requires recent login"-type errors)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: 'Greška',
          description: 'Trenutna lozinka nije ispravna.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          title: 'Greška',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Lozinka promenjena',
        description: 'Vaša lozinka je uspešno promenjena.',
      });

      setOpen(false);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {asDropdownItem ? (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <KeyRound className="mr-2 h-4 w-4" />
            Promeni lozinku
          </DropdownMenuItem>
        ) : (
          <Button variant="ghost" className={buttonClassName}>
            <KeyRound className="mr-2 h-4 w-4" />
            Promeni lozinku
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promena lozinke</DialogTitle>
          <DialogDescription>
            Unesite trenutnu lozinku i postavite novu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Trenutna lozinka</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova lozinka</Label>
            <Input
              id="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potvrdi novu lozinku</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sačuvaj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

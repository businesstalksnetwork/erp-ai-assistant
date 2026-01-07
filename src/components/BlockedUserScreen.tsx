import { Lock, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/pausal-box-logo.png';

interface BlockedUserScreenProps {
  reason: string | null;
  onSignOut: () => void;
}

export function BlockedUserScreen({ reason, onSignOut }: BlockedUserScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center">
          <img src={logo} alt="Paušal box" className="h-12 mx-auto" />
        </div>

        <Card className="border-destructive/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Pristup vašem nalogu je onemogućen</CardTitle>
            <CardDescription>
              {reason || 'Vaš nalog je trenutno blokiran.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Za obnovu pristupa kontaktirajte administratora:
              </p>
              <a
                href="mailto:admin@pausalbox.com"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                admin@pausalbox.com
              </a>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={onSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Odjavi se
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

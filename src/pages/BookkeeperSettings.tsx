import { useState } from 'react';
import { useBookkeeperInvitations } from '@/hooks/useBookkeeper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Check, X, Loader2, Mail, Users, Send, Trash2 } from 'lucide-react';

export default function BookkeeperSettings() {
  const {
    sentInvitations,
    receivedInvitations,
    myClients,
    isLoading,
    sendInvitation,
    respondToInvitation,
    cancelInvitation,
  } = useBookkeeperInvitations();

  const [email, setEmail] = useState('');

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await sendInvitation.mutateAsync(email);
      toast.success('Pozivnica poslata!');
      setEmail('');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Već ste poslali pozivnicu ovom knjigovođi');
      } else {
        toast.error('Greška pri slanju pozivnice');
      }
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await respondToInvitation.mutateAsync({ id, status: 'accepted' });
      toast.success('Pozivnica prihvaćena! Sada možete videti firme ovog klijenta.');
    } catch (error) {
      toast.error('Greška pri prihvatanju pozivnice');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await respondToInvitation.mutateAsync({ id, status: 'rejected' });
      toast.success('Pozivnica odbijena');
    } catch (error) {
      toast.error('Greška pri odbijanju pozivnice');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelInvitation.mutateAsync(id);
      toast.success('Pozivnica otkazana');
    } catch (error) {
      toast.error('Greška pri otkazivanju pozivnice');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Na čekanju</Badge>;
      case 'accepted':
        return <Badge variant="default" className="bg-green-600">Prihvaćeno</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Odbijeno</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingReceived = receivedInvitations.filter(inv => inv.status === 'pending');

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Knjigovodstvo</h1>
        <p className="text-muted-foreground">
          Upravljajte povezivanjem sa knjigovođom ili klijentima
        </p>
      </div>

      <Tabs defaultValue="client" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="client" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Ja sam klijent
          </TabsTrigger>
          <TabsTrigger value="bookkeeper" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ja sam knjigovođa
            {pendingReceived.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingReceived.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Client Tab - Send invitations to bookkeeper */}
        <TabsContent value="client" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pozovi knjigovođu
              </CardTitle>
              <CardDescription>
                Unesite email adresu vašeg knjigovođe da bi mogao da pristupi vašim podacima
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendInvitation} className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="email" className="sr-only">Email knjigovođe</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@knjigovodja.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={sendInvitation.isPending || !email.trim()}>
                  {sendInvitation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Pošalji pozivnicu'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {sentInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Moje pozivnice</CardTitle>
                <CardDescription>Pozivnice koje ste poslali knjigovođama</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sentInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{inv.bookkeeper_email}</p>
                        <p className="text-sm text-muted-foreground">
                          Poslato: {new Date(inv.created_at).toLocaleDateString('sr-RS')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(inv.status)}
                        {inv.status === 'pending' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCancel(inv.id)}
                            title="Otkaži pozivnicu"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bookkeeper Tab - Receive invitations and manage clients */}
        <TabsContent value="bookkeeper" className="space-y-4">
          {pendingReceived.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pozivnice na čekanju
                </CardTitle>
                <CardDescription>
                  Klijenti koji žele da budete njihov knjigovođa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingReceived.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-secondary/30"
                    >
                      <div>
                        <p className="font-medium">{inv.client_name || 'Nepoznat korisnik'}</p>
                        <p className="text-sm text-muted-foreground">{inv.client_email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(inv.id)}
                          disabled={respondToInvitation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Odbij
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(inv.id)}
                          disabled={respondToInvitation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Prihvati
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Moji klijenti
              </CardTitle>
              <CardDescription>
                Klijenti čije podatke možete videti i uređivati
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nemate povezanih klijenata. Kada klijent pošalje pozivnicu i vi je prihvatite,
                  pojaviće se ovde.
                </p>
              ) : (
                <div className="space-y-3">
                  {myClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{client.client_name || 'Korisnik'}</p>
                        <p className="text-sm text-muted-foreground">{client.client_email}</p>
                      </div>
                      <Badge variant="default" className="bg-green-600">Povezan</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

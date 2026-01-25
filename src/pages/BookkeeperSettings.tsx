import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompanies } from '@/hooks/useCompanies';
import { useCompanyBookkeeper } from '@/hooks/useCompanyBookkeeper';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InviteClientDialog } from '@/components/InviteClientDialog';

import { toast } from 'sonner';
import { Check, X, Loader2, Mail, Users, Send, Building2, ExternalLink, CheckCircle2, Clock, UserCheck, UserX, Settings, UserPlus } from 'lucide-react';

interface CompanyWithOwner {
  id: string;
  name: string;
  address: string;
  pib: string;
  logo_url: string | null;
  has_sef_api_key: boolean;
  bookkeeper_status: string;
  bookkeeper_invited_at: string;
  user_id: string;
  owner_name?: string;
  owner_email?: string;
}

export default function BookkeeperSettings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { myCompanies, clientCompanies, isLoading: companiesLoading } = useCompanies();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { acceptInvitation, rejectInvitation } = useCompanyBookkeeper();

  // Fetch pending invitations for me as bookkeeper (from companies table)
  const { data: pendingInvitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['bookkeeper-pending-invitations', profile?.email],
    queryFn: async () => {
      if (!profile?.email) return [];

      // Get companies where I'm invited as bookkeeper (pending status)
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, address, pib, logo_url, has_sef_api_key, bookkeeper_status, bookkeeper_invited_at, user_id')
        .eq('bookkeeper_email', profile.email)
        .eq('bookkeeper_status', 'pending');

      if (error) throw error;
      if (!companies?.length) return [];

      // Fetch owner profiles
      const ownerIds = companies.map(c => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);

      return companies.map(company => ({
        ...company,
        owner_name: profiles?.find(p => p.id === company.user_id)?.full_name,
        owner_email: profiles?.find(p => p.id === company.user_id)?.email,
      })) as CompanyWithOwner[];
    },
    enabled: !!profile?.email,
  });

  const handleAccept = async (companyId: string) => {
    try {
      await acceptInvitation.mutateAsync(companyId);
      toast.success('Pozivnica prihvaćena! Sada možete videti podatke ove kompanije.');
    } catch (error) {
      toast.error('Greška pri prihvatanju pozivnice');
    }
  };

  const handleReject = async (companyId: string) => {
    try {
      await rejectInvitation.mutateAsync(companyId);
      toast.success('Pozivnica odbijena');
    } catch (error) {
      toast.error('Greška pri odbijanju pozivnice');
    }
  };

  const getBookkeeperStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <Clock className="h-3 w-3 mr-1" />
            Na čekanju
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <UserCheck className="h-3 w-3 mr-1" />
            Povezan
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
            <UserX className="h-3 w-3 mr-1" />
            Odbijeno
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Nema knjigovođu
          </Badge>
        );
    }
  };

  if (companiesLoading || invitationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Korisnik je "efektivni knjigovođa" ako ima klijentske kompanije ili pending pozivnice
  const hasClientCompanies = clientCompanies.length > 0;
  const hasPendingInvitations = pendingInvitations.length > 0;
  const isRegisteredBookkeeper = profile?.account_type === 'bookkeeper';
  const showBookkeeperSection = hasClientCompanies || isRegisteredBookkeeper || hasPendingInvitations;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto px-4 sm:px-0 overflow-x-hidden">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Knjigovodstvo</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {showBookkeeperSection 
            ? 'Upravljajte pozivnicama i kompanijama vaših klijenata'
            : 'Upravljajte povezivanjem sa knjigovođom'}
        </p>
      </div>

      {/* Pozivnice na čekanju - prikaži ako ima pending pozivnica */}
      {hasPendingInvitations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pozivnice na čekanju
              <Badge variant="destructive" className="ml-1">{pendingInvitations.length}</Badge>
            </CardTitle>
            <CardDescription>
              Klijenti koji žele da budete njihov knjigovođa za navedene kompanije
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-secondary/30 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border shrink-0" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{company.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        Od: {company.owner_name || company.owner_email || 'Nepoznat korisnik'}
                      </p>
                      <p className="text-xs text-muted-foreground">PIB: {company.pib}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(company.id)}
                      disabled={rejectInvitation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      <X className="h-4 w-4 sm:mr-1" />
                      <span className="sm:inline">Odbij</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(company.id)}
                      disabled={acceptInvitation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      <Check className="h-4 w-4 sm:mr-1" />
                      <span className="sm:inline">Prihvati</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kompanije klijenata - prikaži ako je efektivni knjigovođa */}
      {showBookkeeperSection && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Kompanije klijenata
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Kompanije vaših klijenata kojima imate pristup
                </CardDescription>
              </div>
              <Button onClick={() => setInviteDialogOpen(true)} className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                Pozovi klijenta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {clientCompanies.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nemate povezanih klijenata. Kada klijent pošalje pozivnicu za svoju kompaniju i vi je prihvatite,
                kompanija će se pojaviti ovde.
              </p>
            ) : (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 overflow-hidden">
                {clientCompanies.map((company) => (
                  <Card
                    key={company.id}
                    className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                    onClick={() => navigate(`/company/${company.id}`)}
                  >
                    <CardContent className="pt-4 overflow-hidden">
                      <div className="flex items-start gap-3">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{company.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">{company.address}</p>
                          <p className="text-xs text-primary mt-1 truncate">Klijent: {company.client_name}</p>
                        </div>
                        {company.has_sef_api_key ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : null}
                      </div>
                      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <span>PIB: {company.pib}</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Moje kompanije - prikaži uvek */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Moje kompanije
          </CardTitle>
          <CardDescription>
            Pozovite knjigovođu za svaku kompaniju pojedinačno u podešavanjima kompanije
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myCompanies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nemate kreiranih kompanija.
            </p>
          ) : (
            <div className="space-y-3">
              {myCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border shrink-0" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{company.name}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                        <span className="shrink-0">PIB: {company.pib}</span>
                        {company.bookkeeper_email && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate text-xs sm:text-sm">{company.bookkeeper_email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    {getBookkeeperStatusBadge(company.bookkeeper_status)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/company/${company.id}`)}
                      className="shrink-0"
                    >
                      <Settings className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Podešavanja</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">
        💡 Da biste pozvali knjigovođu, otvorite podešavanja željene kompanije i u tabu "Servisi" pronađite sekciju "Knjigovođa".
      </p>

      <InviteClientDialog 
        open={inviteDialogOpen} 
        onOpenChange={setInviteDialogOpen} 
      />
    </div>
  );
}

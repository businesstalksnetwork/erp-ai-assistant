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

import { toast } from 'sonner';
import { Check, X, Loader2, Mail, Users, Send, Building2, ExternalLink, CheckCircle2, Clock, UserCheck, UserX, Settings } from 'lucide-react';

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

  // Filter companies that have a bookkeeper invitation
  const companiesWithBookkeeper = myCompanies.filter(c => c.bookkeeper_email);

  const isBookkeeper = profile?.account_type === 'bookkeeper';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Knjigovodstvo</h1>
        <p className="text-muted-foreground">
          {isBookkeeper 
            ? 'Upravljajte pozivnicama i kompanijama vaših klijenata'
            : 'Upravljajte povezivanjem sa knjigovođom'}
        </p>
      </div>

      {/* Za paušalce - direktan prikaz "Moje kompanije" bez tabova */}
      {!isBookkeeper && (
        <>
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
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>PIB: {company.pib}</span>
                            {company.bookkeeper_email && (
                              <>
                                <span>•</span>
                                <span>{company.bookkeeper_email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getBookkeeperStatusBadge(company.bookkeeper_status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/company/${company.id}`)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Podešavanja
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground text-center">
            💡 Da biste pozvali knjigovođu, otvorite podešavanja željene kompanije i u tabu "Servisi" pronađite sekciju "Knjigovođa".
          </p>
        </>
      )}

      {/* Za knjigovođe - direktan prikaz pozivnica i klijenata bez tabova */}
      {isBookkeeper && (
        <>
          {pendingInvitations.length > 0 && (
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
                      className="flex items-center justify-between p-4 border rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Od: {company.owner_name || company.owner_email || 'Nepoznat korisnik'}
                          </p>
                          <p className="text-xs text-muted-foreground">PIB: {company.pib}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(company.id)}
                          disabled={rejectInvitation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Odbij
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(company.id)}
                          disabled={acceptInvitation.isPending}
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
                <Building2 className="h-5 w-5" />
                Kompanije klijenata
              </CardTitle>
              <CardDescription>
                Kompanije vaših klijenata kojima imate pristup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientCompanies.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nemate povezanih klijenata. Kada klijent pošalje pozivnicu za svoju kompaniju i vi je prihvatite,
                  kompanija će se pojaviti ovde.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {clientCompanies.map((company) => (
                    <Card
                      key={company.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/company/${company.id}`)}
                    >
                      <CardContent className="pt-4">
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
                            <p className="text-xs text-primary mt-1">Klijent: {company.client_name}</p>
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
        </>
      )}
    </div>
  );
}

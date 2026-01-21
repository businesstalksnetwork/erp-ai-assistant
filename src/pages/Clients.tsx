import { useState, useEffect, useCallback } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useClients } from '@/hooks/useClients';
import { useSEFRegistry, SEFRegistryResult } from '@/hooks/useSEFRegistry';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2, Loader2, Building2, Search, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function Clients() {
  const { selectedCompany } = useSelectedCompany();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients(selectedCompany?.id || null);
  const { checkPibInRegistry, isChecking: isSefChecking } = useSEFRegistry();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [sefCheckResult, setSefCheckResult] = useState<SEFRegistryResult | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    pib: '',
    maticni_broj: '',
    vat_number: '',
    client_type: 'domestic' as 'domestic' | 'foreign',
    sef_registered: false,
  });

  // SEF je dostupan samo ako kompanija ima konfigurisan API ključ
  const isSefConfigured = selectedCompany?.sef_enabled && !!selectedCompany?.sef_api_key;

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      pib: '',
      maticni_broj: '',
      vat_number: '',
      client_type: 'domestic',
      sef_registered: false,
    });
    setEditId(null);
    setSefCheckResult(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  // Check SEF registry when PIB changes - SAMO ako je SEF konfigurisan
  const handlePibChange = useCallback(async (pib: string) => {
    setFormData(prev => ({ ...prev, pib }));
    setSefCheckResult(null);

    // Proveri SEF registar SAMO ako kompanija ima konfigurisan SEF
    if (isSefConfigured && pib.length === 9 && /^\d{9}$/.test(pib)) {
      const result = await checkPibInRegistry(pib);
      setSefCheckResult(result);
      
      if (result.found && result.isActive) {
        // Automatically enable SEF registration for active companies
        setFormData(prev => ({ ...prev, sef_registered: true }));
        
        toast({
          title: '✓ Firma je u SEF registru',
          description: result.registrationDate 
            ? `Registrovana od: ${new Date(result.registrationDate).toLocaleDateString('sr-Latn-RS')}`
            : 'Firma je aktivna u SEF sistemu',
        });
      }
    }
  }, [checkPibInRegistry, toast, isSefConfigured]);

  const handleEdit = (client: typeof clients[0]) => {
    setFormData({
      name: client.name,
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      pib: client.pib || '',
      maticni_broj: client.maticni_broj || '',
      vat_number: client.vat_number || '',
      client_type: client.client_type,
      sef_registered: client.sef_registered || false,
    });
    setEditId(client.id);
    setIsOpen(true);
  };

  const handleAprLookup = async () => {
    if (formData.pib.length !== 9) {
      toast({ title: 'Greška', description: 'PIB mora imati 9 cifara', variant: 'destructive' });
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('apr-lookup', {
        body: { pib: formData.pib },
      });

      if (error) throw error;

      if (data.found) {
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          address: data.address || prev.address,
          city: data.city || prev.city,
          maticni_broj: data.maticni_broj || prev.maticni_broj,
        }));
        toast({ title: 'Podaci pronađeni', description: `Firma: ${data.name}` });
      } else {
        toast({ title: 'Nije pronađeno', description: data.error || 'Firma nije pronađena u APR registru', variant: 'destructive' });
      }
    } catch (error) {
      console.error('APR lookup error:', error);
      toast({ title: 'Greška', description: 'Neuspešno pretraživanje APR registra', variant: 'destructive' });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    if (editId) {
      await updateClient.mutateAsync({ id: editId, ...formData });
    } else {
      await createClient.mutateAsync({
        ...formData,
        company_id: selectedCompany.id,
      });
    }
    handleOpenChange(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteClient.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">
          Izaberite firmu iz menija da biste videli klijente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Klijenti</h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">Upravljajte listom klijenata</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Novi klijent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editId ? 'Izmeni klijenta' : 'Novi klijent'}</DialogTitle>
                <DialogDescription>
                  Unesite podatke o klijentu
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Naziv / Ime klijenta</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Naziv firme ili ime fizičkog lica"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_type">Tip klijenta</Label>
                  <Select
                    value={formData.client_type}
                    onValueChange={(value: 'domestic' | 'foreign') => 
                      setFormData({ ...formData, client_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domestic">Domaći</SelectItem>
                      <SelectItem value="foreign">Strani</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresa</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Ulica i broj"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Mesto</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Beograd"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Država</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder={formData.client_type === 'domestic' ? 'Srbija (opciono)' : 'Nemačka'}
                  />
                </div>
                {formData.client_type === 'domestic' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pib">PIB</Label>
                      <div className="flex gap-2">
                        <Input
                          id="pib"
                          value={formData.pib}
                          onChange={(e) => handlePibChange(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456789"
                          maxLength={9}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAprLookup}
                          disabled={isLookingUp || formData.pib.length !== 9}
                          title="Pretraži APR"
                        >
                          {isLookingUp ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Unesite PIB i kliknite na lupu za automatsko povlačenje podataka (NBS/APR)</p>
                      
                      {/* SEF Registry Status Indicator - samo ako je SEF konfigurisan */}
                      {isSefConfigured && isSefChecking && formData.pib.length === 9 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Provera SEF registra...</span>
                        </div>
                      )}
                      
                      {isSefConfigured && sefCheckResult?.found && sefCheckResult.isActive && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Firma je registrovana u SEF sistemu
                            {sefCheckResult.registrationDate && ` od ${new Date(sefCheckResult.registrationDate).toLocaleDateString('sr-Latn-RS')}`}
                          </span>
                        </div>
                      )}
                      
                      {isSefConfigured && sefCheckResult?.found && !sefCheckResult.isActive && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                          <AlertCircle className="h-4 w-4" />
                          <span>Firma je bila u SEF registru, ali je obrisana</span>
                        </div>
                      )}
                      
                      {isSefConfigured && sefCheckResult?.found === false && formData.pib.length === 9 && !isSefChecking && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          <span>Firma nije pronađena u SEF registru</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maticni_broj">Matični broj</Label>
                      <Input
                        id="maticni_broj"
                        value={formData.maticni_broj}
                        onChange={(e) => setFormData({ ...formData, maticni_broj: e.target.value })}
                        placeholder="12345678"
                        maxLength={8}
                      />
                    </div>
                    {/* SEF Registration Toggle - samo ako je SEF konfigurisan */}
                    {isSefConfigured && (
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="space-y-0.5">
                          <Label htmlFor="sef-registered" className="cursor-pointer">Registrovan u SEF sistemu</Label>
                          <p className="text-xs text-muted-foreground">
                            Klijent je registrovan za prijem elektronskih faktura
                          </p>
                        </div>
                        <Switch
                          id="sef-registered"
                          checked={formData.sef_registered}
                          onCheckedChange={(checked) => setFormData({ ...formData, sef_registered: checked })}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">VAT broj</Label>
                    <Input
                      id="vat_number"
                      value={formData.vat_number}
                      onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      placeholder="DE123456789"
                    />
                    <p className="text-xs text-muted-foreground">Poreski identifikacioni broj stranog klijenta</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Otkaži
                </Button>
                <Button type="submit" disabled={createClient.isPending || updateClient.isPending}>
                  {(createClient.isPending || updateClient.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editId ? 'Sačuvaj' : 'Dodaj'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nemate dodatih klijenata</p>
            <p className="text-muted-foreground mb-4">Dodajte klijente da biste ih koristili prilikom kreiranja faktura</p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj klijenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg truncate">{client.name}</CardTitle>
                    <CardDescription className="truncate text-xs sm:text-sm">{client.address || 'Bez adrese'}</CardDescription>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {isSefConfigured && client.sef_registered && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] sm:text-xs">
                        <Send className="h-3 w-3 mr-1" />
                        SEF
                      </Badge>
                    )}
                    <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                      {client.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-3 sm:gap-4 min-w-0">
                    {client.client_type === 'domestic' ? (
                      <>
                        {client.pib && (
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">PIB</p>
                            <p className="font-mono text-xs sm:text-sm truncate">{client.pib}</p>
                          </div>
                        )}
                        {client.maticni_broj && (
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">MB</p>
                            <p className="font-mono text-xs sm:text-sm truncate">{client.maticni_broj}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      client.vat_number && (
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">VAT</p>
                          <p className="font-mono text-xs sm:text-sm truncate">{client.vat_number}</p>
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(client)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteId(client.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši klijenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati klijenta. Fakture vezane za ovog klijenta neće biti obrisane.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

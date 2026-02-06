import { useState, useCallback, useEffect } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useClients, Client } from '@/hooks/useClients';
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus, Pencil, Trash2, Loader2, Building2, Search, Send, CheckCircle, AlertCircle, X, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ClientDetailPanel } from '@/components/ClientDetailPanel';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Clients() {
  const { selectedCompany } = useSelectedCompany();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients(selectedCompany?.id || null);
  const { checkPibInRegistry, isChecking: isSefChecking } = useSEFRegistry();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [sefCheckResult, setSefCheckResult] = useState<SEFRegistryResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    pib: '',
    maticni_broj: '',
    vat_number: '',
    email: '',
    client_type: 'domestic' as 'domestic' | 'foreign',
    sef_registered: false,
  });

  // Auto-save draft for client form (only when dialog is open and not editing)
  const { clearDraft: clearClientDraft } = useFormDraft(
    'new-client',
    formData,
    (restored) => {
      setFormData(restored);
      // Auto-open dialog when draft is restored
      if (!isOpen) {
        setIsOpen(true);
        toast({
          title: 'Vraćen sačuvan nacrt klijenta',
          description: 'Prethodno uneti podaci su restaurirani.',
        });
      }
    },
    {
      companyId: selectedCompany?.id,
      enabled: isOpen && !editId, // Only save when adding new client
    }
  );

  // SEF je dostupan samo ako kompanija ima konfigurisan API ključ
  const isSefConfigured = selectedCompany?.sef_enabled && selectedCompany?.has_sef_api_key;

  // Filter clients based on search
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.pib?.includes(searchQuery) ||
    client.vat_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      pib: '',
      maticni_broj: '',
      vat_number: '',
      email: '',
      client_type: 'domestic',
      sef_registered: false,
    });
    setEditId(null);
    setSefCheckResult(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      clearClientDraft();
      resetForm();
    }
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

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name,
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      pib: client.pib || '',
      maticni_broj: client.maticni_broj || '',
      vat_number: client.vat_number || '',
      email: client.email || '',
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
      if (selectedClientId === deleteId) {
        setSelectedClientId(null);
      }
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

  const ClientFormDialog = (
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
            
            {/* Email field - for all client types */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email klijenta
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
              />
              <p className="text-xs text-muted-foreground">Za slanje faktura emailom</p>
            </div>
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
  );

  // Empty state
  if (!isLoading && clients.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Klijenti</h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">Upravljajte listom klijenata</p>
          </div>
          {ClientFormDialog}
        </div>
        
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
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Client list item component
  const ClientListItem = ({ client }: { client: Client }) => (
    <div
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
        selectedClientId === client.id && "bg-muted border-primary"
      )}
      onClick={() => setSelectedClientId(client.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight break-words line-clamp-2" title={client.name}>
            {client.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {client.address || 'Bez adrese'}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isSefConfigured && client.sef_registered && (
            <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
              <Send className="h-2.5 w-2.5 mr-0.5" />
              SEF
            </Badge>
          )}
          <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'} className="text-[10px]">
            {client.client_type === 'domestic' ? 'D' : 'S'}
          </Badge>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
        {client.client_type === 'domestic' ? (
          client.pib && <span className="font-mono">PIB: {client.pib}</span>
        ) : (
          client.vat_number && <span className="font-mono">VAT: {client.vat_number}</span>
        )}
      </div>
    </div>
  );

  // Main content with master-detail layout
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in h-[calc(100vh-10rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Klijenti</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'klijent' : clients.length < 5 ? 'klijenta' : 'klijenata'}
          </p>
        </div>
        {ClientFormDialog}
      </div>

      {/* Desktop: Resizable panels */}
      <div className="hidden lg:block h-[calc(100%-4rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
          {/* Client List Panel */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži klijente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <ClientListItem key={client.id} client={client} />
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nema rezultata pretrage
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Detail Panel */}
          <ResizablePanel defaultSize={65}>
            <div className="h-full p-4">
              {selectedClient ? (
                <ClientDetailPanel
                  client={selectedClient}
                  companyId={selectedCompany.id}
                  isSefConfigured={isSefConfigured || false}
                  onEdit={() => handleEdit(selectedClient)}
                  onDelete={() => setDeleteId(selectedClient.id)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">Izaberite klijenta</p>
                  <p className="text-sm">Kliknite na klijenta sa leve strane da vidite detalje</p>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile/Tablet: Card grid with Drawer for details */}
      <div className="lg:hidden">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži klijente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {filteredClients.map((client) => (
            <Card 
              key={client.id} 
              className="cursor-pointer transition-colors hover:bg-muted/50 active:scale-[0.98]"
              onClick={() => {
                setSelectedClientId(client.id);
                setMobileDrawerOpen(true);
              }}
            >
              <CardHeader className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle
                      className="text-sm sm:text-base leading-tight break-words line-clamp-2"
                      title={client.name}
                    >
                      {client.name}
                    </CardTitle>
                    <CardDescription className="truncate text-xs">{client.address || 'Bez adrese'}</CardDescription>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {isSefConfigured && client.sef_registered && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                        <Send className="h-2.5 w-2.5 mr-0.5" />
                        SEF
                      </Badge>
                    )}
                    <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'} className="text-[10px]">
                      {client.client_type === 'domestic' ? 'D' : 'S'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-3 min-w-0 text-xs text-muted-foreground">
                    {client.client_type === 'domestic' ? (
                      client.pib && <span className="font-mono">PIB: {client.pib}</span>
                    ) : (
                      client.vat_number && <span className="font-mono truncate">VAT: {client.vat_number}</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(client); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {filteredClients.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Nema rezultata pretrage
            </CardContent>
          </Card>
        )}
        
        {/* Mobile Drawer for client details */}
        <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-2">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-base">Detalji klijenta</DrawerTitle>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto">
              {selectedClient && (
                <ClientDetailPanel
                  client={selectedClient}
                  companyId={selectedCompany.id}
                  isSefConfigured={isSefConfigured || false}
                  onEdit={() => {
                    handleEdit(selectedClient);
                    setMobileDrawerOpen(false);
                  }}
                  onDelete={() => {
                    setDeleteId(selectedClient.id);
                    setMobileDrawerOpen(false);
                  }}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>

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

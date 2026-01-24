import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { useForeignPaymentInstructions } from '@/hooks/useForeignPaymentInstructions';
import { useCompanyBookkeeper } from '@/hooks/useCompanyBookkeeper';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Building2, CreditCard, FileStack, Eye, EyeOff, Plus, Pencil, Trash2, CheckCircle2, XCircle, Upload, X, Calculator, Settings, Users, Mail, Clock, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'];

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companies, isLoading: companiesLoading, updateCompany, deleteCompany } = useCompanies();
  const { instructions, isLoading: instructionsLoading, createInstruction, updateInstruction, deleteInstruction } = useForeignPaymentInstructions(id || null);
  const { inviteBookkeeper, cancelInvitation, removeBookkeeper } = useCompanyBookkeeper();
  
  const [company, setCompany] = useState<Company | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [sefApiKey, setSefApiKey] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);
  
  // Foreign payment instructions state
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<any>(null);
  const [instructionForm, setInstructionForm] = useState({ currency: 'EUR', instructions: '' });
  
  // Edit company dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    city: '',
    country: 'Srbija',
    pib: '',
    maticni_broj: '',
    is_active: true,
  });
  
  // Logo upload
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch SEF API key separately (direct query for security)
  const [hasSefApiKey, setHasSefApiKey] = useState(false);
  
  // Bookkeeper dialog state
  const [isBookkeeperDialogOpen, setIsBookkeeperDialogOpen] = useState(false);
  const [bookkeeperEmail, setBookkeeperEmail] = useState('');
  
  useEffect(() => {
    if (companies && id) {
      const found = companies.find(c => c.id === id);
      if (found) {
        setCompany(found);
        setHasSefApiKey(found.has_sef_api_key || false);
        setBankAccount(found.bank_account || '');
        setEditForm({
          name: found.name,
          address: found.address,
          city: found.city || '',
          country: found.country || 'Srbija',
          pib: found.pib,
          maticni_broj: found.maticni_broj,
          is_active: found.is_active,
        });
      }
    }
  }, [companies, id]);

  const handleSaveSefApiKey = async () => {
    if (!company) return;
    setIsSavingApiKey(true);
    try {
      // Update SEF API key directly via Supabase (not through Company interface)
      const { error } = await supabase
        .from('companies')
        .update({ sef_api_key: sefApiKey || null })
        .eq('id', company.id);
      
      if (error) throw error;
      
      setHasSefApiKey(!!sefApiKey);
      setSefApiKey(''); // Clear the input after save
      
      // Invalidate companies queries to refresh sidebar navigation
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: ['client-companies'] });
      
      toast.success('SEF API ključ sačuvan');
    } catch (error) {
      toast.error('Greška pri čuvanju API ključa');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!company) return;
    setIsSavingBankAccount(true);
    try {
      await updateCompany.mutateAsync({ id: company.id, bank_account: bankAccount });
      toast.success('Bankovni račun sačuvan');
    } catch (error) {
      toast.error('Greška pri čuvanju');
    } finally {
      setIsSavingBankAccount(false);
    }
  };

  const handleSaveCompanyDetails = async () => {
    if (!company) return;
    try {
      await updateCompany.mutateAsync({ id: company.id, ...editForm });
      setIsEditDialogOpen(false);
      toast.success('Podaci firme ažurirani');
    } catch (error) {
      toast.error('Greška pri čuvanju');
    }
  };

  const handleDeleteCompany = async () => {
    if (!company) return;
    try {
      await deleteCompany.mutateAsync(company.id);
      toast.success('Firma obrisana');
      navigate('/companies');
    } catch (error) {
      toast.error('Greška pri brisanju firme');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!company || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      toast.error('Molimo izaberite sliku');
      return;
    }
    
    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${company.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      await updateCompany.mutateAsync({ id: company.id, logo_url: publicUrl });
      toast.success('Logo ažuriran');
    } catch (error) {
      toast.error('Greška pri uploadu loga');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!company) return;
    try {
      await updateCompany.mutateAsync({ id: company.id, logo_url: null });
      toast.success('Logo uklonjen');
    } catch (error) {
      toast.error('Greška pri uklanjanju loga');
    }
  };

  // Foreign payment instructions handlers
  const openAddInstruction = () => {
    setEditingInstruction(null);
    setInstructionForm({ currency: 'EUR', instructions: '' });
    setIsInstructionDialogOpen(true);
  };

  const openEditInstruction = (instruction: any) => {
    setEditingInstruction(instruction);
    setInstructionForm({ currency: instruction.currency, instructions: instruction.instructions });
    setIsInstructionDialogOpen(true);
  };

  const handleSaveInstruction = async () => {
    if (!instructionForm.instructions.trim() || !company) {
      toast.error('Unesite instrukcije za plaćanje');
      return;
    }
    
    try {
      if (editingInstruction) {
        await updateInstruction.mutateAsync({
          id: editingInstruction.id,
          currency: instructionForm.currency,
          instructions: instructionForm.instructions,
        });
        toast.success('Instrukcije ažurirane');
      } else {
        await createInstruction.mutateAsync({
          company_id: company.id,
          currency: instructionForm.currency,
          instructions: instructionForm.instructions,
        });
        toast.success('Instrukcije sačuvane');
      }
      setIsInstructionDialogOpen(false);
    } catch (error) {
      toast.error('Greška pri čuvanju');
    }
  };

  const handleDeleteInstruction = async (instructionId: string) => {
    try {
      await deleteInstruction.mutateAsync(instructionId);
      toast.success('Instrukcije obrisane');
    } catch (error) {
      toast.error('Greška pri brisanju');
    }
  };

  if (companiesLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/companies')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nazad
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Firma nije pronađena</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded" />
            ) : (
              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{company.name}</h1>
              <p className="text-sm text-muted-foreground">PIB: {company.pib}</p>
            </div>
          </div>
        </div>
        <Badge variant={company.is_active ? 'default' : 'secondary'}>
          {company.is_active ? 'Aktivna' : 'Neaktivna'}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Podaci</span>
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Računi</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Servisi</span>
          </TabsTrigger>
          <TabsTrigger value="bookkeeper" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Knjigovođa</span>
          </TabsTrigger>
        </TabsList>

        {/* Basic Data Tab */}
        <TabsContent value="basic">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Osnovni podaci</CardTitle>
                <CardDescription>Informacije o firmi</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Izmeni
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Section */}
              <div className="flex items-start gap-4 pb-4 border-b">
                <div className="relative">
                  {company.logo_url ? (
                    <div className="relative group">
                      <img src={company.logo_url} alt="Logo" className="h-20 w-20 object-contain rounded border" />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 bg-muted rounded border flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">Logo firme</Label>
                  <p className="text-xs text-muted-foreground mb-2">Preporučena veličina: 200x200px</p>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" disabled={isUploadingLogo} asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingLogo ? 'Učitavanje...' : 'Promeni logo'}
                      </span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>

              {/* Company Details Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs">Naziv</Label>
                  <p className="font-medium">{company.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <p className="font-medium">{company.is_active ? 'Aktivna' : 'Neaktivna'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">PIB</Label>
                  <p className="font-medium">{company.pib}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Matični broj</Label>
                  <p className="font-medium">{company.maticni_broj}</p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Adresa</Label>
                  <p className="font-medium">{company.address}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Grad</Label>
                  <p className="font-medium">{company.city || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Država</Label>
                  <p className="font-medium">{company.country || '-'}</p>
                </div>
              </div>

              {/* Delete Company */}
              <div className="pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši firmu
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Obrisati firmu?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ova akcija će trajno obrisati firmu "{company.name}" i sve povezane podatke. 
                        Ovo se ne može poništiti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Obriši
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Accounts Tab */}
        <TabsContent value="bank" className="space-y-4">
          {/* Domestic Bank Account */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dinarski račun</CardTitle>
              <CardDescription>Račun za domaća plaćanja u RSD</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="123-1234567890123-12"
                  className="flex-1"
                />
                <Button 
                  onClick={handleSaveBankAccount} 
                  disabled={isSavingBankAccount || bankAccount === (company.bank_account || '')}
                >
                  {isSavingBankAccount ? 'Čuvanje...' : 'Sačuvaj'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Foreign Payment Instructions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Devizne instrukcije</CardTitle>
                <CardDescription>Instrukcije za plaćanja u stranim valutama</CardDescription>
              </div>
              <Button size="sm" onClick={openAddInstruction}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj
              </Button>
            </CardHeader>
            <CardContent>
              {instructionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : instructions && instructions.length > 0 ? (
                <div className="space-y-3">
                  {instructions.map((instruction) => (
                    <div key={instruction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-sm font-semibold">
                          {instruction.currency}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditInstruction(instruction)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Obrisati instrukcije?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Instrukcije za {instruction.currency} će biti trajno obrisane.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Otkaži</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteInstruction(instruction.id)}>
                                  Obriši
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-line text-muted-foreground">{instruction.instructions}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nema sačuvanih deviznih instrukcija</p>
                  <p className="text-sm">Dodajte instrukcije za brže kreiranje faktura</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Servisi
              </CardTitle>
              <CardDescription>
                Upravljajte dodatnim servisima za ovu firmu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SEF Integration Toggle */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileStack className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SEF Centar</p>
                      <p className="text-xs text-muted-foreground">
                        Sistem e-Faktura integracija
                        {company.sef_enabled && !hasSefApiKey && (
                          <span className="text-amber-500 ml-1">• API ključ nije podešen</span>
                        )}
                        {company.sef_enabled && hasSefApiKey && (
                          <span className="text-green-500 ml-1">• Povezano</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={company.sef_enabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateCompany.mutateAsync({ 
                          id: company.id, 
                          sef_enabled: checked 
                        });
                        toast.success(checked ? 'SEF Centar uključen' : 'SEF Centar isključen');
                      } catch (error) {
                        toast.error('Greška pri promeni statusa');
                      }
                    }}
                  />
                </div>
                
                {/* SEF Configuration - shown when enabled */}
                {company.sef_enabled && (
                  <div className="pt-4 border-t space-y-4">
                    {/* Connection Status */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      {hasSefApiKey ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-600">Povezano</p>
                            <p className="text-sm text-muted-foreground">API ključ je konfigurisan</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Nije konfigurisano</p>
                            <p className="text-sm text-muted-foreground">Unesite API ključ za aktivaciju</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                      <Label htmlFor="sef_api_key">SEF API ključ</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="sef_api_key"
                            type={showApiKey ? 'text' : 'password'}
                            value={sefApiKey}
                            onChange={(e) => setSefApiKey(e.target.value)}
                            placeholder="Unesite API ključ sa SEF portala"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button 
                          onClick={handleSaveSefApiKey} 
                          disabled={isSavingApiKey || !sefApiKey}
                        >
                          {isSavingApiKey ? 'Čuvanje...' : (hasSefApiKey ? 'Zameni ključ' : 'Sačuvaj')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        API ključ možete preuzeti sa SEF portala (efaktura.mfin.gov.rs) u sekciji Podešavanja → API pristup
                      </p>
                    </div>

                    {/* SEF Center Link */}
                    <Button variant="outline" size="sm" onClick={() => navigate('/sef')}>
                      <FileStack className="h-4 w-4 mr-2" />
                      Otvori SEF Centar
                    </Button>
                  </div>
                )}
              </div>

              {/* Fiscal Cash Register Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Fiskalna kasa</p>
                    <p className="text-xs text-muted-foreground">Uvoz i praćenje fiskalnih računa</p>
                  </div>
                </div>
                <Switch
                  checked={company.fiscal_enabled}
                  onCheckedChange={async (checked) => {
                    try {
                      await updateCompany.mutateAsync({ 
                        id: company.id, 
                        fiscal_enabled: checked 
                      });
                      toast.success(checked ? 'Fiskalna kasa uključena' : 'Fiskalna kasa isključena');
                    } catch (error) {
                      toast.error('Greška pri promeni statusa');
                    }
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                Aktivirani servisi će se pojaviti u bočnoj navigaciji aplikacije.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookkeeper Tab */}
        <TabsContent value="bookkeeper">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Knjigovođa
              </CardTitle>
              <CardDescription>
                Dodelite knjigovođu koji će imati pristup podacima ove kompanije
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Display */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                {company.bookkeeper_email && company.bookkeeper_status === 'accepted' ? (
                  <>
                    <UserCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-600">Povezan</p>
                      <p className="text-sm text-muted-foreground">{company.bookkeeper_email}</p>
                    </div>
                  </>
                ) : company.bookkeeper_email && company.bookkeeper_status === 'pending' ? (
                  <>
                    <Clock className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-600">Pozivnica poslata</p>
                      <p className="text-sm text-muted-foreground">Čeka se odgovor: {company.bookkeeper_email}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Nije dodeljen</p>
                      <p className="text-sm text-muted-foreground">Pozovite knjigovođu putem email adrese</p>
                    </div>
                  </>
                )}
              </div>

              {/* Action Row */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {company.bookkeeper_email ? 'Upravljanje pristupom' : 'Pozovi knjigovođu'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.bookkeeper_email 
                        ? 'Možete otkazati poziv ili ukloniti pristup'
                        : 'Pošaljite pozivnicu na email adresu knjigovođe'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {company.bookkeeper_email && company.bookkeeper_status === 'pending' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">Otkaži poziv</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Otkazati pozivnicu?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Pozivnica za {company.bookkeeper_email} će biti otkazana.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Ne</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelInvitation.mutate(company.id)}>
                            Da, otkaži
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  {company.bookkeeper_email && company.bookkeeper_status === 'accepted' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive">
                          Ukloni pristup
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ukloniti pristup knjigovođi?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {company.bookkeeper_email} više neće moći da pristupa podacima ove kompanije.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Ne</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeBookkeeper.mutate(company.id)}>
                            Da, ukloni
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  {(!company.bookkeeper_email || company.bookkeeper_status === 'rejected') && (
                    <Button size="sm" onClick={() => {
                      setBookkeeperEmail('');
                      setIsBookkeeperDialogOpen(true);
                    }}>
                      <Mail className="h-4 w-4 mr-2" />
                      Pozovi knjigovođu
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Knjigovođa će moći da pregleda fakture, KPO knjigu i druge finansijske podatke ove kompanije.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Izmeni podatke firme</DialogTitle>
            <DialogDescription>Ažurirajte osnovne informacije o firmi</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_name">Naziv firme *</Label>
              <Input
                id="edit_name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_address">Adresa *</Label>
              <Input
                id="edit_address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_city">Grad</Label>
                <Input
                  id="edit_city"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_country">Država</Label>
                <Input
                  id="edit_country"
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_pib">PIB *</Label>
                <Input
                  id="edit_pib"
                  value={editForm.pib}
                  onChange={(e) => setEditForm({ ...editForm, pib: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_maticni">Matični broj *</Label>
                <Input
                  id="edit_maticni"
                  value={editForm.maticni_broj}
                  onChange={(e) => setEditForm({ ...editForm, maticni_broj: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveCompanyDetails} disabled={updateCompany.isPending}>
              {updateCompany.isPending ? 'Čuvanje...' : 'Sačuvaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foreign Payment Instruction Dialog */}
      <Dialog open={isInstructionDialogOpen} onOpenChange={setIsInstructionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingInstruction ? 'Izmeni instrukcije' : 'Dodaj devizne instrukcije'}
            </DialogTitle>
            <DialogDescription>
              Unesite bankarske instrukcije za plaćanje u izabranoj valuti
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Valuta</Label>
              <select
                id="currency"
                value={instructionForm.currency}
                onChange={(e) => setInstructionForm({ ...instructionForm, currency: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={!!editingInstruction}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instrukcije za plaćanje</Label>
              <Textarea
                id="instructions"
                value={instructionForm.instructions}
                onChange={(e) => setInstructionForm({ ...instructionForm, instructions: e.target.value })}
                placeholder="IBAN: RS35...&#10;SWIFT/BIC: CITIRS2X&#10;Banka: Citibank..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstructionDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveInstruction} disabled={createInstruction.isPending || updateInstruction.isPending}>
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bookkeeper Invitation Dialog */}
      <Dialog open={isBookkeeperDialogOpen} onOpenChange={setIsBookkeeperDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pozovi knjigovođu</DialogTitle>
            <DialogDescription>
              Unesite email adresu vašeg knjigovođe. Pozivnica će biti poslata na tu adresu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bookkeeper_email">Email adresa knjigovođe</Label>
              <Input
                id="bookkeeper_email"
                type="email"
                value={bookkeeperEmail}
                onChange={(e) => setBookkeeperEmail(e.target.value)}
                placeholder="knjigovodja@primer.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookkeeperDialogOpen(false)}>
              Otkaži
            </Button>
            <Button 
              onClick={() => {
                if (!bookkeeperEmail.trim()) {
                  toast.error('Unesite email adresu');
                  return;
                }
                if (company) {
                  inviteBookkeeper.mutate({ companyId: company.id, email: bookkeeperEmail });
                  setIsBookkeeperDialogOpen(false);
                }
              }}
              disabled={inviteBookkeeper.isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              Pošalji pozivnicu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

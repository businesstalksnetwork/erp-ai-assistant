import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { useForeignPaymentInstructions } from '@/hooks/useForeignPaymentInstructions';
import { useCompanyBookkeeper } from '@/hooks/useCompanyBookkeeper';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, Plus, Pencil, Trash2, Loader2, Upload, X, ExternalLink, CheckCircle2, 
  Circle, AlertCircle, CreditCard, FileStack, Eye, EyeOff, Calculator, Settings, 
  Users, Mail, Clock, UserCheck, UserX, XCircle 
} from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';

const companySchema = z.object({
  name: z.string().min(2, 'Naziv mora imati najmanje 2 karaktera'),
  address: z.string().min(5, 'Unesite validnu adresu'),
  pib: z.string().regex(/^\d{9}$/, 'PIB mora imati tačno 9 cifara'),
  maticni_broj: z.string().regex(/^\d{8}$/, 'Matični broj mora imati tačno 8 cifara'),
  bank_account: z.string().optional(),
});

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'];

// Inline Company Profile component
function InlineCompanyProfile({ company, onCompanyUpdated }: { company: Company; onCompanyUpdated?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { updateCompany, deleteCompany } = useCompanies();
  const { instructions, isLoading: instructionsLoading, createInstruction, updateInstruction, deleteInstruction } = useForeignPaymentInstructions(company.id);
  const { inviteBookkeeper, cancelInvitation, removeBookkeeper } = useCompanyBookkeeper();
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [sefApiKey, setSefApiKey] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [bankAccount, setBankAccount] = useState(company.bank_account || '');
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);
  const [hasSefApiKey, setHasSefApiKey] = useState(company.has_sef_api_key || false);
  
  // Email settings state
  const [autoSendEmail, setAutoSendEmail] = useState(company.auto_send_invoice_email || false);
  const [emailSignatureSr, setEmailSignatureSr] = useState(company.email_signature_sr || '');
  const [emailSignatureEn, setEmailSignatureEn] = useState(company.email_signature_en || '');
  const [signatureTab, setSignatureTab] = useState<'sr' | 'en'>('sr');
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  
  // Foreign payment instructions state
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<any>(null);
  const [instructionForm, setInstructionForm] = useState({ currency: 'EUR', instructions: '' });
  
  // Edit company dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: company.name,
    address: company.address,
    city: company.city || '',
    country: company.country || 'Srbija',
    pib: company.pib,
    maticni_broj: company.maticni_broj,
    is_active: company.is_active,
  });
  
  // Logo upload
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Bookkeeper dialog state
  const [isBookkeeperDialogOpen, setIsBookkeeperDialogOpen] = useState(false);
  const [bookkeeperEmail, setBookkeeperEmail] = useState('');

  useEffect(() => {
    setBankAccount(company.bank_account || '');
    setHasSefApiKey(company.has_sef_api_key || false);
    setAutoSendEmail(company.auto_send_invoice_email || false);
    setEmailSignatureSr(company.email_signature_sr || '');
    setEmailSignatureEn(company.email_signature_en || '');
    setEditForm({
      name: company.name,
      address: company.address,
      city: company.city || '',
      country: company.country || 'Srbija',
      pib: company.pib,
      maticni_broj: company.maticni_broj,
      is_active: company.is_active,
    });
  }, [company]);

  const handleSaveSefApiKey = async () => {
    setIsSavingApiKey(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ sef_api_key: sefApiKey || null })
        .eq('id', company.id);
      
      if (error) throw error;
      
      setHasSefApiKey(!!sefApiKey);
      setSefApiKey('');
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      sonnerToast.success('SEF API ključ sačuvan');
    } catch (error) {
      sonnerToast.error('Greška pri čuvanju API ključa');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSaveBankAccount = async () => {
    setIsSavingBankAccount(true);
    try {
      await updateCompany.mutateAsync({ id: company.id, bank_account: bankAccount });
      sonnerToast.success('Bankovni račun sačuvan');
    } catch (error) {
      sonnerToast.error('Greška pri čuvanju');
    } finally {
      setIsSavingBankAccount(false);
    }
  };

  const handleSaveCompanyDetails = async () => {
    try {
      await updateCompany.mutateAsync({ id: company.id, ...editForm });
      setIsEditDialogOpen(false);
      sonnerToast.success('Podaci firme ažurirani');
    } catch (error) {
      sonnerToast.error('Greška pri čuvanju');
    }
  };

  const handleDeleteCompany = async () => {
    try {
      await deleteCompany.mutateAsync(company.id);
      sonnerToast.success('Firma obrisana');
    } catch (error) {
      sonnerToast.error('Greška pri brisanju firme');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      sonnerToast.error('Molimo izaberite sliku');
      return;
    }
    
    setIsUploadingLogo(true);
    try {
      // Upload to DigitalOcean Spaces via edge function
      const result = await uploadFile({
        type: 'logo',
        companyId: company.id,
        file,
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update company with new logo URL
      await updateCompany.mutateAsync({ id: company.id, logo_url: result.url });
      sonnerToast.success('Logo ažuriran');
    } catch (error) {
      sonnerToast.error('Greška pri uploadu loga');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateCompany.mutateAsync({ id: company.id, logo_url: null });
      sonnerToast.success('Logo uklonjen');
    } catch (error) {
      sonnerToast.error('Greška pri uklanjanju loga');
    }
  };

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
    if (!instructionForm.instructions.trim()) {
      sonnerToast.error('Unesite instrukcije za plaćanje');
      return;
    }
    
    try {
      if (editingInstruction) {
        await updateInstruction.mutateAsync({
          id: editingInstruction.id,
          currency: instructionForm.currency,
          instructions: instructionForm.instructions,
        });
        sonnerToast.success('Instrukcije ažurirane');
      } else {
        await createInstruction.mutateAsync({
          company_id: company.id,
          currency: instructionForm.currency,
          instructions: instructionForm.instructions,
        });
        sonnerToast.success('Instrukcije sačuvane');
      }
      setIsInstructionDialogOpen(false);
    } catch (error) {
      sonnerToast.error('Greška pri čuvanju');
    }
  };

  const handleDeleteInstruction = async (instructionId: string) => {
    try {
      await deleteInstruction.mutateAsync(instructionId);
      sonnerToast.success('Instrukcije obrisane');
    } catch (error) {
      sonnerToast.error('Greška pri brisanju');
    }
  };

  const handleInviteBookkeeper = async () => {
    if (!bookkeeperEmail.trim()) return;
    try {
      await inviteBookkeeper.mutateAsync({ companyId: company.id, email: bookkeeperEmail });
      setIsBookkeeperDialogOpen(false);
      setBookkeeperEmail('');
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
              <h2 className="text-xl font-bold">{company.name}</h2>
              <p className="text-sm text-muted-foreground">PIB: {company.pib}</p>
            </div>
          </div>
        </div>
        <Badge variant={company.is_active ? 'default' : 'secondary'}>
          {company.is_active ? 'Aktivna' : 'Neaktivna'}
        </Badge>
      </div>

      {/* Tabs - horizontally scrollable on mobile */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto scrollbar-hide gap-1 justify-start sm:grid sm:grid-cols-4 sm:overflow-visible">
          <TabsTrigger value="basic" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Podaci</span>
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Računi</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Servisi</span>
          </TabsTrigger>
          <TabsTrigger value="bookkeeper" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Knjigovođa</span>
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
                        await updateCompany.mutateAsync({ id: company.id, sef_enabled: checked });
                        sonnerToast.success(checked ? 'SEF Centar uključen' : 'SEF Centar isključen');
                      } catch (error) {
                        sonnerToast.error('Greška pri promeni statusa');
                      }
                    }}
                  />
                </div>
                
                {company.sef_enabled && (
                  <div className="pt-4 border-t space-y-4">
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
                      await updateCompany.mutateAsync({ id: company.id, fiscal_enabled: checked });
                      sonnerToast.success(checked ? 'Fiskalna kasa uključena' : 'Fiskalna kasa isključena');
                    } catch (error) {
                      sonnerToast.error('Greška pri promeni statusa');
                    }
                  }}
                />
              </div>

              {/* Email Settings */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email podešavanja</p>
                      <p className="text-xs text-muted-foreground">
                        Podešavanja za slanje faktura emailom
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t space-y-4">
                  {/* Auto-send toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">Automatsko slanje</p>
                      <p className="text-xs text-muted-foreground">
                        Automatski otvori dijalog za slanje emailom nakon kreiranja fakture
                      </p>
                    </div>
                    <Switch
                      checked={autoSendEmail}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateCompany.mutateAsync({ id: company.id, auto_send_invoice_email: checked });
                          setAutoSendEmail(checked);
                          sonnerToast.success(checked ? 'Automatsko slanje uključeno' : 'Automatsko slanje isključeno');
                        } catch (error) {
                          sonnerToast.error('Greška pri promeni statusa');
                        }
                      }}
                    />
                  </div>

                  {/* Email signature */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Potpis emaila</Label>
                      <div className="flex gap-1">
                        <Button
                          variant={signatureTab === 'sr' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSignatureTab('sr')}
                          className="h-7 text-xs"
                        >
                          🇷🇸 Srpski
                        </Button>
                        <Button
                          variant={signatureTab === 'en' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSignatureTab('en')}
                          className="h-7 text-xs"
                        >
                          🇬🇧 English
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      placeholder={signatureTab === 'sr' 
                        ? "S poštovanjem,\nPetar Petrović\nDirektor, Firma d.o.o.\nTel: +381 11 123 4567" 
                        : "Best regards,\nPetar Petrovic\nDirector, Company Ltd.\nTel: +381 11 123 4567"}
                      value={signatureTab === 'sr' ? emailSignatureSr : emailSignatureEn}
                      onChange={(e) => {
                        if (signatureTab === 'sr') {
                          setEmailSignatureSr(e.target.value);
                        } else {
                          setEmailSignatureEn(e.target.value);
                        }
                      }}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Potpis će biti dodat na kraj svakog email-a sa fakturom. Podržan je HTML format.
                    </p>

                    {showSignaturePreview && (
                      <div className="p-3 bg-muted/50 rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-2">Pregled potpisa:</p>
                        <div 
                          className="text-sm whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ 
                            __html: signatureTab === 'sr' ? emailSignatureSr : emailSignatureEn 
                          }}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSignaturePreview(!showSignaturePreview)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {showSignaturePreview ? 'Sakrij pregled' : 'Pregled'}
                      </Button>
                      <Button
                        size="sm"
                        disabled={isSavingSignature}
                        onClick={async () => {
                          setIsSavingSignature(true);
                          try {
                            await updateCompany.mutateAsync({
                              id: company.id,
                              email_signature_sr: emailSignatureSr || null,
                              email_signature_en: emailSignatureEn || null,
                            });
                            sonnerToast.success('Potpis sačuvan');
                          } catch (error) {
                            sonnerToast.error('Greška pri čuvanju potpisa');
                          } finally {
                            setIsSavingSignature(false);
                          }
                        }}
                      >
                        {isSavingSignature ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Sačuvaj potpis
                      </Button>
                    </div>
                  </div>
                </div>
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
            <CardContent className="space-y-4">
              {company.bookkeeper_email && company.bookkeeper_status === 'accepted' ? (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-600">Povezan</p>
                      <p className="text-sm text-muted-foreground">{company.bookkeeper_email}</p>
                    </div>
                  </div>
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
                </div>
              ) : company.bookkeeper_email && company.bookkeeper_status === 'pending' ? (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-600">Pozivnica poslata</p>
                      <p className="text-sm text-muted-foreground">Čeka se odgovor: {company.bookkeeper_email}</p>
                    </div>
                  </div>
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
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nije dodeljen knjigovođa</p>
                  </div>
                  <Button size="sm" onClick={() => {
                    setBookkeeperEmail('');
                    setIsBookkeeperDialogOpen(true);
                  }}>
                    <Mail className="h-4 w-4 mr-2" />
                    Pozovi
                  </Button>
                </div>
              )}

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
                <Label htmlFor="edit_pib">PIB</Label>
                <Input
                  id="edit_pib"
                  value={editForm.pib}
                  onChange={(e) => setEditForm({ ...editForm, pib: e.target.value })}
                  maxLength={9}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_maticni">Matični broj</Label>
                <Input
                  id="edit_maticni"
                  value={editForm.maticni_broj}
                  onChange={(e) => setEditForm({ ...editForm, maticni_broj: e.target.value })}
                  maxLength={8}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit_active"
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
              />
              <Label htmlFor="edit_active">Aktivna firma</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveCompanyDetails} disabled={updateCompany.isPending}>
              {updateCompany.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foreign Payment Instruction Dialog */}
      <Dialog open={isInstructionDialogOpen} onOpenChange={setIsInstructionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInstruction ? 'Izmeni instrukcije' : 'Nove devizne instrukcije'}</DialogTitle>
            <DialogDescription>Unesite podatke za devizno plaćanje</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valuta</Label>
              <Select value={instructionForm.currency} onValueChange={(v) => setInstructionForm({ ...instructionForm, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instrukcije za plaćanje</Label>
              <Textarea
                value={instructionForm.instructions}
                onChange={(e) => setInstructionForm({ ...instructionForm, instructions: e.target.value })}
                placeholder="Beneficiary: ...&#10;IBAN: ...&#10;SWIFT: ...&#10;Bank: ..."
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

      {/* Bookkeeper Invite Dialog */}
      <Dialog open={isBookkeeperDialogOpen} onOpenChange={setIsBookkeeperDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pozovi knjigovođu</DialogTitle>
            <DialogDescription>Unesite email adresu knjigovođe</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bookkeeper_email">Email adresa</Label>
            <Input
              id="bookkeeper_email"
              type="email"
              value={bookkeeperEmail}
              onChange={(e) => setBookkeeperEmail(e.target.value)}
              placeholder="knjigovodja@example.com"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookkeeperDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleInviteBookkeeper} disabled={inviteBookkeeper.isPending || !bookkeeperEmail.trim()}>
              {inviteBookkeeper.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pošalji poziv
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main Companies component
export default function Companies() {
  const navigate = useNavigate();
  const { myCompanies, isLoading, createCompany, updateCompany, deleteCompany } = useCompanies();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: 'Srbija',
    pib: '',
    maticni_broj: '',
    bank_account: '',
    is_active: true,
    fiscal_enabled: false,
    sef_enabled: false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set first company as active by default
  useEffect(() => {
    if (myCompanies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(myCompanies[0].id);
    }
  }, [myCompanies, activeCompanyId]);

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: 'Srbija',
      pib: '',
      maticni_broj: '',
      bank_account: '',
      is_active: true,
      fiscal_enabled: false,
      sef_enabled: false,
    });
    setErrors({});
    setEditId(null);
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoUrl(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Greška', description: 'Molimo izaberite sliku', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Greška', description: 'Slika mora biti manja od 2MB', variant: 'destructive' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadLogo = async (companyId: string): Promise<string | null> => {
    if (!logoFile) return existingLogoUrl;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${companyId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: 'Greška pri upload-u loga', variant: 'destructive' });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = companySchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    const newCompany = await createCompany.mutateAsync({ ...formData });
    if (logoFile && newCompany?.id) {
      const logoUrl = await uploadLogo(newCompany.id);
      if (logoUrl) {
        await updateCompany.mutateAsync({ id: newCompany.id, logo_url: logoUrl } as any);
      }
    }
    if (newCompany?.id) {
      setActiveCompanyId(newCompany.id);
    }
    handleOpenChange(false);
  };

  const maxCompanies = profile?.max_companies ?? 1;
  const canAddCompany = isAdmin || myCompanies.length < maxCompanies;
  const hasMultipleCompanies = maxCompanies > 1 || myCompanies.length > 1;
  const activeCompany = myCompanies.find(c => c.id === activeCompanyId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {hasMultipleCompanies ? 'Moje Kompanije' : 'Moja Kompanija'}
          </h1>
          <p className="text-muted-foreground">
            {hasMultipleCompanies ? 'Upravljajte vašim kompanijama' : 'Upravljajte vašom kompanijom'}
            {!isAdmin && maxCompanies > 1 && (
              <span className="ml-2 text-xs">
                ({myCompanies.length}/{maxCompanies})
              </span>
            )}
          </p>
        </div>
        {canAddCompany && (myCompanies.length === 0 || hasMultipleCompanies) && (
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj kompaniju
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Nova kompanija</DialogTitle>
                  <DialogDescription>
                    Unesite podatke o vašoj kompaniji
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Naziv firme</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Moja firma d.o.o."
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Adresa / Sedište</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Ulica i broj"
                      />
                      {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
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
                    <div className="space-y-2">
                      <Label htmlFor="country">Država</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        placeholder="Srbija (opciono)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pib">PIB</Label>
                      <Input
                        id="pib"
                        value={formData.pib}
                        onChange={(e) => setFormData({ ...formData, pib: e.target.value })}
                        placeholder="123456789"
                        maxLength={9}
                      />
                      {errors.pib && <p className="text-sm text-destructive">{errors.pib}</p>}
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
                      {errors.maticni_broj && <p className="text-sm text-destructive">{errors.maticni_broj}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Broj računa (opciono)</Label>
                    <Input
                      id="bank_account"
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      placeholder="265-0000000000000-00"
                    />
                  </div>

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label>Logo firme (opciono)</Label>
                    <div className="flex items-center gap-4">
                      {(logoPreview || existingLogoUrl) ? (
                        <div className="relative">
                          <img
                            src={logoPreview || existingLogoUrl || ''}
                            alt="Logo preview"
                            className="h-16 w-16 object-contain border rounded-lg bg-background"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={removeLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="h-16 w-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {logoPreview || existingLogoUrl ? 'Promeni logo' : 'Izaberi logo'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG do 2MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Otkaži
                  </Button>
                  <Button type="submit" disabled={createCompany.isPending || uploadingLogo}>
                    {(createCompany.isPending || uploadingLogo) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Dodaj
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Limit warning */}
      {!isAdmin && !canAddCompany && myCompanies.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm">
              Dostigli ste ograničenje od {maxCompanies} {maxCompanies === 1 ? 'firme' : 'firmi'}. 
              Kontaktirajte administratora za proširenje limita.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : myCompanies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nemate dodatu nijednu kompaniju</p>
            <p className="text-muted-foreground mb-4">Dodajte vašu prvu kompaniju da biste počeli sa radom</p>
            <Button onClick={() => setIsOpen(true)} disabled={!canAddCompany}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj kompaniju
            </Button>
          </CardContent>
        </Card>
      ) : myCompanies.length === 1 ? (
        // Single company - show profile directly
        <InlineCompanyProfile company={myCompanies[0]} />
      ) : (
        // Multiple companies - show horizontal tabs
        <Tabs value={activeCompanyId || ''} onValueChange={setActiveCompanyId}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {myCompanies.map((company) => (
              <TabsTrigger key={company.id} value={company.id} className="flex items-center gap-2 min-w-fit">
                {company.logo_url ? (
                  <img src={company.logo_url} alt="" className="h-4 w-4 object-contain rounded" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span className="truncate max-w-[150px]">{company.name}</span>
                {!company.is_active && (
                  <Badge variant="secondary" className="text-xs">Neaktivna</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {myCompanies.map((company) => (
            <TabsContent key={company.id} value={company.id} className="mt-6">
              <InlineCompanyProfile company={company} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

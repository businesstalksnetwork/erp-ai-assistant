import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanies } from '@/hooks/useCompanies';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Building2, Plus, Pencil, Trash2, Loader2, Upload, X, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const companySchema = z.object({
  name: z.string().min(2, 'Naziv mora imati najmanje 2 karaktera'),
  address: z.string().min(5, 'Unesite validnu adresu'),
  pib: z.string().regex(/^\d{9}$/, 'PIB mora imati tačno 9 cifara'),
  maticni_broj: z.string().regex(/^\d{8}$/, 'Matični broj mora imati tačno 8 cifara'),
  bank_account: z.string().optional(),
});

export default function Companies() {
  const navigate = useNavigate();
  const { companies, isLoading, createCompany, updateCompany, deleteCompany } = useCompanies();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleEdit = (company: typeof companies[0]) => {
    setFormData({
      name: company.name,
      address: company.address,
      city: company.city || '',
      country: company.country || '',
      pib: company.pib,
      maticni_broj: company.maticni_broj,
      bank_account: company.bank_account || '',
      is_active: company.is_active,
      fiscal_enabled: company.fiscal_enabled,
    });
    setEditId(company.id);
    setExistingLogoUrl((company as any).logo_url || null);
    setLogoPreview(null);
    setLogoFile(null);
    setIsOpen(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Greška', description: 'Molimo izaberite sliku', variant: 'destructive' });
      return;
    }

    // Validate file size (max 2MB)
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

    if (editId) {
      const logoUrl = await uploadLogo(editId);
      await updateCompany.mutateAsync({ 
        id: editId, 
        ...formData, 
        logo_url: logoUrl 
      } as any);
    } else {
      const newCompany = await createCompany.mutateAsync({ ...formData, sef_api_key: null });
      if (logoFile && newCompany?.id) {
        const logoUrl = await uploadLogo(newCompany.id);
        if (logoUrl) {
          await updateCompany.mutateAsync({ id: newCompany.id, logo_url: logoUrl } as any);
        }
      }
    }
    handleOpenChange(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCompany.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Firme</h1>
          <p className="text-muted-foreground">Upravljajte vašim firmama</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova firma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editId ? 'Izmeni firmu' : 'Nova firma'}</DialogTitle>
                <DialogDescription>
                  Unesite podatke o vašoj firmi
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
                <Button type="submit" disabled={createCompany.isPending || updateCompany.isPending || uploadingLogo}>
                  {(createCompany.isPending || updateCompany.isPending || uploadingLogo) && (
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
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nemate dodatu nijednu firmu</p>
            <p className="text-muted-foreground mb-4">Dodajte vašu prvu firmu da biste počeli sa radom</p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj firmu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card 
              key={company.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/company/${company.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-contain rounded border" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      {company.name}
                      {company.is_active && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success">
                          Aktivna
                        </Badge>
                      )}
                      {company.sef_api_key ? (
                        <span className="flex items-center gap-1" title="SEF API ključ podešen">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600 dark:text-green-400">SEF</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" title="SEF API ključ nije podešen">
                          <Circle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">SEF</span>
                        </span>
                      )}
                    </CardTitle>
                      <CardDescription>{company.address}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(company)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(company.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">PIB</p>
                    <p className="font-mono">{company.pib}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Matični broj</p>
                    <p className="font-mono">{company.maticni_broj}</p>
                  </div>
                  {company.is_client_company && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Klijent</p>
                      <p className="text-sm">{company.client_name}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Klikni za detalje</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši firmu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati firmu i sve povezane podatke (fakture, KPO, podsetnike).
              Ovo se ne može poništiti.
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

import { useState } from 'react';
import { useCompanies } from '@/hooks/useCompanies';
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
import { Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { z } from 'zod';

const companySchema = z.object({
  name: z.string().min(2, 'Naziv mora imati najmanje 2 karaktera'),
  address: z.string().min(5, 'Unesite validnu adresu'),
  pib: z.string().regex(/^\d{9}$/, 'PIB mora imati tačno 9 cifara'),
  maticni_broj: z.string().regex(/^\d{8}$/, 'Matični broj mora imati tačno 8 cifara'),
  bank_account: z.string().optional(),
});

export default function Companies() {
  const { companies, isLoading, createCompany, updateCompany, deleteCompany } = useCompanies();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    pib: '',
    maticni_broj: '',
    bank_account: '',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      pib: '',
      maticni_broj: '',
      bank_account: '',
      is_active: true,
    });
    setErrors({});
    setEditId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (company: typeof companies[0]) => {
    setFormData({
      name: company.name,
      address: company.address,
      pib: company.pib,
      maticni_broj: company.maticni_broj,
      bank_account: company.bank_account || '',
      is_active: company.is_active,
    });
    setEditId(company.id);
    setIsOpen(true);
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
      await updateCompany.mutateAsync({ id: editId, ...formData });
    } else {
      await createCompany.mutateAsync(formData);
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
                <div className="space-y-2">
                  <Label htmlFor="address">Adresa / Sedište</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ulica i broj, Grad"
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Otkaži
                </Button>
                <Button type="submit" disabled={createCompany.isPending || updateCompany.isPending}>
                  {(createCompany.isPending || updateCompany.isPending) && (
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
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {company.name}
                      {company.is_active && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success">
                          Aktivna
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{company.address}</CardDescription>
                  </div>
                  <div className="flex gap-2">
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
                  {company.bank_account && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Broj računa</p>
                      <p className="font-mono">{company.bank_account}</p>
                    </div>
                  )}
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

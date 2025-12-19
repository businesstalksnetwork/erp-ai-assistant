import { useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useClients } from '@/hooks/useClients';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react';

export default function Clients() {
  const { selectedCompany } = useSelectedCompany();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients(selectedCompany?.id || null);
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    pib: '',
    maticni_broj: '',
    client_type: 'domestic' as 'domestic' | 'foreign',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      pib: '',
      maticni_broj: '',
      client_type: 'domestic',
    });
    setEditId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (client: typeof clients[0]) => {
    setFormData({
      name: client.name,
      address: client.address || '',
      pib: client.pib || '',
      maticni_broj: client.maticni_broj || '',
      client_type: client.client_type,
    });
    setEditId(client.id);
    setIsOpen(true);
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Klijenti</h1>
          <p className="text-muted-foreground">Upravljajte listom klijenata za {selectedCompany.name}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novi klijent
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                <div className="space-y-2">
                  <Label htmlFor="address">Adresa</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ulica i broj, Grad"
                  />
                </div>
                {formData.client_type === 'domestic' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pib">PIB</Label>
                      <Input
                        id="pib"
                        value={formData.pib}
                        onChange={(e) => setFormData({ ...formData, pib: e.target.value })}
                        placeholder="123456789"
                        maxLength={9}
                      />
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
                  </>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <CardDescription>{client.address || 'Bez adrese'}</CardDescription>
                  </div>
                  <Badge variant={client.client_type === 'domestic' ? 'default' : 'secondary'}>
                    {client.client_type === 'domestic' ? 'Domaći' : 'Strani'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    {client.pib && (
                      <div>
                        <p className="text-xs text-muted-foreground">PIB</p>
                        <p className="font-mono text-sm">{client.pib}</p>
                      </div>
                    )}
                    {client.maticni_broj && (
                      <div>
                        <p className="text-xs text-muted-foreground">MB</p>
                        <p className="font-mono text-sm">{client.maticni_broj}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(client)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(client.id)}>
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

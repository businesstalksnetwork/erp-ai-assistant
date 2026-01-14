import { useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useForeignPaymentInstructions } from '@/hooks/useForeignPaymentInstructions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Banknote, DollarSign, Euro, PoundSterling } from 'lucide-react';

const CURRENCIES = [
  { value: 'EUR', label: 'EUR - Euro', icon: Euro },
  { value: 'USD', label: 'USD - Američki dolar', icon: DollarSign },
  { value: 'GBP', label: 'GBP - Britanska funta', icon: PoundSterling },
  { value: 'CHF', label: 'CHF - Švajcarski franak', icon: Banknote },
  { value: 'RUB', label: 'RUB - Ruski rublja', icon: Banknote },
  { value: 'CAD', label: 'CAD - Kanadski dolar', icon: Banknote },
  { value: 'AUD', label: 'AUD - Australijski dolar', icon: Banknote },
  { value: 'JPY', label: 'JPY - Japanski jen', icon: Banknote },
  { value: 'CNY', label: 'CNY - Kineski juan', icon: Banknote },
];

const getCurrencyIcon = (currency: string) => {
  const found = CURRENCIES.find(c => c.value === currency);
  return found?.icon || Banknote;
};

export default function ForeignPaymentInstructions() {
  const { selectedCompany } = useSelectedCompany();
  const { instructions, isLoading, createInstruction, updateInstruction, deleteInstruction } = useForeignPaymentInstructions(selectedCompany?.id || null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    currency: '',
    instructions: '',
  });

  const usedCurrencies = instructions.map(i => i.currency);
  const availableCurrencies = CURRENCIES.filter(c => !usedCurrencies.includes(c.value) || (editingId && instructions.find(i => i.id === editingId)?.currency === c.value));

  const handleOpenDialog = (instruction?: typeof instructions[0]) => {
    if (instruction) {
      setEditingId(instruction.id);
      setFormData({
        currency: instruction.currency,
        instructions: instruction.instructions,
      });
    } else {
      setEditingId(null);
      setFormData({
        currency: '',
        instructions: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ currency: '', instructions: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCompany) return;
    
    if (editingId) {
      await updateInstruction.mutateAsync({
        id: editingId,
        currency: formData.currency,
        instructions: formData.instructions,
      });
    } else {
      await createInstruction.mutateAsync({
        company_id: selectedCompany.id,
        currency: formData.currency,
        instructions: formData.instructions,
      });
    }
    
    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    await deleteInstruction.mutateAsync(id);
  };

  if (!selectedCompany) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Molimo izaberite firmu.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devizne instrukcije za plaćanje</h1>
          <p className="text-muted-foreground">
            Definišite instrukcije za uplate u stranim valutama koje će se automatski dodavati na fakture za inostrane klijente.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={availableCurrencies.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj instrukciju
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Učitavanje...</p>
          </CardContent>
        </Card>
      ) : instructions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Banknote className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Nema definisanih instrukcija</p>
                <p className="text-sm text-muted-foreground">
                  Dodajte instrukcije za plaćanje za različite valute koje koristite u poslovanju sa inostranstvom.
                </p>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj prvu instrukciju
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instructions.map((instruction) => {
            const IconComponent = getCurrencyIcon(instruction.currency);
            return (
              <Card key={instruction.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{instruction.currency}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(instruction)}>
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
                            <AlertDialogTitle>Obrisati instrukciju?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da obrišete instrukciju za {instruction.currency}? Ova akcija se ne može poništiti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(instruction.id)}>Obriši</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription>
                    {CURRENCIES.find(c => c.value === instruction.currency)?.label || instruction.currency}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {instruction.instructions}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Izmeni instrukciju' : 'Dodaj novu instrukciju'}</DialogTitle>
            <DialogDescription>
              Unesite instrukcije za plaćanje u izabranoj valuti. Ove instrukcije će se automatski dodati u napomenu fakture za inostrane klijente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Valuta</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite valutu" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instrukcije za plaćanje</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder={`Beneficiary: Naziv Firme d.o.o.
Address: Ulica i broj, Grad, Srbija
IBAN: RS35265100000012345678
SWIFT/BIC: RZBSRSBG
Bank: Naziv banke
Bank Address: Adresa banke`}
                rows={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Unesite sve potrebne podatke za deviznu uplatu: naziv primaoca, IBAN, SWIFT kod, naziv i adresu banke.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Otkaži
              </Button>
              <Button type="submit" disabled={!formData.currency || !formData.instructions}>
                {editingId ? 'Sačuvaj izmene' : 'Dodaj instrukciju'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

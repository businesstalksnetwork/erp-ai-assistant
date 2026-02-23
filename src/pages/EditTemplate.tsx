import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoiceTemplates, TemplateItem } from '@/hooks/useInvoiceTemplates';
import { useClients } from '@/hooks/useClients';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Loader2, Save, Plus, Trash2, Check, ChevronsUpDown, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditableItem {
  id: string;
  description: string;
  item_type: 'products' | 'services';
  quantity: number;
  unit_price: number;
  foreign_amount: number;
}

const currencies = ['EUR', 'USD', 'CHF', 'GBP'];

export default function EditTemplate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useSelectedCompany();
  const { templates, getTemplateById, updateTemplate, isLoading: templatesLoading } = useInvoiceTemplates(selectedCompany?.id || null);
  const { clients } = useClients(selectedCompany?.id || null);
  const { activeServices } = useServiceCatalog(selectedCompany?.id || null);
  
  const [loading, setLoading] = useState(false);
  const [openClientPopover, setOpenClientPopover] = useState(false);
  const [openCatalogPopover, setOpenCatalogPopover] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [invoiceType, setInvoiceType] = useState<'regular' | 'proforma' | 'advance'>('regular');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPib, setClientPib] = useState('');
  const [clientMaticniBroj, setClientMaticniBroj] = useState('');
  const [clientVatNumber, setClientVatNumber] = useState('');
  const [clientType, setClientType] = useState<'domestic' | 'foreign'>('domestic');
  const [foreignCurrency, setForeignCurrency] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Virman');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);

  // Load template data when available
  useEffect(() => {
    if (!id || templatesLoading) return;
    
    const template = getTemplateById(id);
    if (!template) {
      toast.error('Šablon nije pronađen');
      navigate('/invoices');
      return;
    }

    setName(template.name);
    setInvoiceType(template.invoice_type as 'regular' | 'proforma' | 'advance');
    setClientId(template.client_id);
    setClientName(template.client_name);
    setClientAddress(template.client_address || '');
    setClientPib(template.client_pib || '');
    setClientMaticniBroj(template.client_maticni_broj || '');
    setClientVatNumber((template as any).client_vat_number || '');
    setClientType(template.client_type as 'domestic' | 'foreign');
    setForeignCurrency(template.foreign_currency || '');
    setPaymentMethod(template.payment_method || 'Virman');
    setNote(template.note || '');
    setItems(template.items.map(item => ({
      id: crypto.randomUUID(),
      description: item.description,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      foreign_amount: item.foreign_amount || 0,
    })));
  }, [id, templates, templatesLoading, getTemplateById, navigate]);

  const handleClientSelect = (selectedClientId: string) => {
    if (selectedClientId === 'new') {
      setClientId(null);
      setClientName('');
      setClientAddress('');
      setClientPib('');
      setClientMaticniBroj('');
      setClientVatNumber('');
      setClientType('domestic');
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      setClientId(client.id);
      setClientName(client.name);
      setClientAddress(client.address || '');
      setClientPib(client.pib || '');
      setClientMaticniBroj(client.maticni_broj || '');
      setClientVatNumber(client.vat_number || '');
      setClientType(client.client_type);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      item_type: 'services',
      quantity: 1,
      unit_price: 0,
      foreign_amount: 0,
    }]);
  };

  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof EditableItem, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Naziv šablona je obavezan');
      return;
    }
    
    if (!clientName.trim()) {
      toast.error('Naziv klijenta je obavezan');
      return;
    }

    if (items.length === 0 || items.every(i => !i.description.trim())) {
      toast.error('Dodajte bar jednu stavku');
      return;
    }

    setLoading(true);

    try {
      const templateItems: TemplateItem[] = items.map(item => ({
        description: item.description,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        foreign_amount: item.foreign_amount,
      }));

      await updateTemplate.mutateAsync({
        id: id!,
        name: name.trim(),
        invoice_type: invoiceType,
        client_id: clientId,
        client_name: clientName.trim(),
        client_address: clientAddress || null,
        client_pib: clientPib || null,
        client_maticni_broj: clientMaticniBroj || null,
        client_vat_number: clientVatNumber || null,
        client_type: clientType,
        foreign_currency: clientType === 'foreign' ? foreignCurrency || null : null,
        payment_method: paymentMethod || null,
        note: note || null,
        items: templateItems,
      });

      navigate('/invoices');
    } catch (error) {
      console.error('Error updating template:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste editovali šablon.</p>
      </div>
    );
  }

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Izmeni šablon</h1>
        <p className="text-muted-foreground">Ažurirajte podatke šablona</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Name */}
        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naziv šablona *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Npr. Mesečna faktura za klijenta X"
              />
            </div>

            <div className="space-y-2">
              <Label>Tip dokumenta</Label>
              <RadioGroup
                value={invoiceType}
                onValueChange={(v) => setInvoiceType(v as 'regular' | 'proforma' | 'advance')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="regular" id="regular" />
                  <Label htmlFor="regular">Faktura</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="proforma" id="proforma" />
                  <Label htmlFor="proforma">Predračun</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="advance" id="advance" />
                  <Label htmlFor="advance">Avans</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Client */}
        <Card>
          <CardHeader>
            <CardTitle>Klijent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Izaberite klijenta</Label>
              <Popover open={openClientPopover} onOpenChange={setOpenClientPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {clientId 
                      ? clients.find(c => c.id === clientId)?.name || clientName
                      : clientName || 'Izaberite klijenta...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pretraži klijente..." />
                    <CommandList>
                      <CommandEmpty>Nema rezultata</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="new" onSelect={() => { handleClientSelect('new'); setOpenClientPopover(false); }}>
                          <Plus className="mr-2 h-4 w-4" />
                          Novi klijent
                        </CommandItem>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => { handleClientSelect(client.id); setOpenClientPopover(false); }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', clientId === client.id ? 'opacity-100' : 'opacity-0')} />
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Naziv klijenta *</Label>
                <Input
                  id="client_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_address">Adresa</Label>
                <Input
                  id="client_address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_pib">PIB</Label>
                <Input
                  id="client_pib"
                  value={clientPib}
                  onChange={(e) => setClientPib(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_maticni_broj">Matični broj</Label>
                <Input
                  id="client_maticni_broj"
                  value={clientMaticniBroj}
                  onChange={(e) => setClientMaticniBroj(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tip klijenta</Label>
              <RadioGroup
                value={clientType}
                onValueChange={(v) => setClientType(v as 'domestic' | 'foreign')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="domestic" id="domestic" />
                  <Label htmlFor="domestic">Domaći</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="foreign" id="foreign" />
                  <Label htmlFor="foreign">Strani</Label>
                </div>
              </RadioGroup>
            </div>

            {clientType === 'foreign' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_vat_number">VAT broj</Label>
                  <Input
                    id="client_vat_number"
                    value={clientVatNumber}
                    onChange={(e) => setClientVatNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valuta</Label>
                  <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Izaberite valutu" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Stavke</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Stavka {index + 1}</span>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Opis</Label>
                    <div className="flex gap-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Opis stavke"
                        className="flex-1"
                      />
                      <Popover open={openCatalogPopover === item.id} onOpenChange={(open) => setOpenCatalogPopover(open ? item.id : null)}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <ListChecks className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <Command>
                            <CommandInput placeholder="Pretraži katalog..." />
                            <CommandList>
                              <CommandEmpty>Nema rezultata</CommandEmpty>
                              <CommandGroup heading="Katalog usluga/proizvoda">
                                {activeServices.map((service) => (
                                  <CommandItem
                                    key={service.id}
                                    value={service.name}
                                    onSelect={() => {
                                      updateItem(item.id, 'description', service.description || service.name);
                                      updateItem(item.id, 'item_type', service.item_type);
                                      if (service.default_unit_price) {
                                        updateItem(item.id, 'unit_price', service.default_unit_price);
                                      }
                                      if (service.default_foreign_price) {
                                        updateItem(item.id, 'foreign_amount', service.default_foreign_price);
                                      }
                                      setOpenCatalogPopover(null);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span>{service.name}</span>
                                      {service.default_unit_price && (
                                        <span className="text-xs text-muted-foreground">
                                          {service.default_unit_price.toLocaleString('sr-RS')} RSD
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tip</Label>
                    <Select 
                      value={item.item_type} 
                      onValueChange={(v) => updateItem(item.id, 'item_type', v as 'products' | 'services')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="services">Usluga</SelectItem>
                        <SelectItem value="products">Proizvod</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Količina</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Jedinična cena (RSD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {clientType === 'foreign' && (
                    <div className="space-y-2">
                      <Label>Iznos ({foreignCurrency || 'valuta'})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.foreign_amount}
                        onChange={(e) => updateItem(item.id, 'foreign_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Dodaj stavku
            </Button>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle>Plaćanje i napomene</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Način plaćanja</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virman">Virman</SelectItem>
                  <SelectItem value="Gotovina">Gotovina</SelectItem>
                  <SelectItem value="Kartica">Kartica</SelectItem>
                  <SelectItem value="PayPal">PayPal</SelectItem>
                  <SelectItem value="Wise">Wise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Napomena</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            Odustani
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Čuvanje...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Sačuvaj izmene
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

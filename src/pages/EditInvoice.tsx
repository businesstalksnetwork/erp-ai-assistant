import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices, InvoiceType } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useForeignPaymentInstructions } from '@/hooks/useForeignPaymentInstructions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Loader2, Save, Plus, Trash2, ListChecks, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';

interface InvoiceItem {
  id: string;
  description: string;
  item_type: 'products' | 'services';
  quantity: number;
  unit_price: number;
  foreign_amount: number;
}

const invoiceSchema = z.object({
  client_name: z.string().min(2, 'Naziv klijenta je obavezan'),
  service_date: z.string().min(1, 'Datum prometa je obavezan'),
  items: z.array(z.object({
    description: z.string().min(2, 'Opis je obavezan'),
    quantity: z.number().min(0.01, 'Količina mora biti veća od 0'),
    unit_price: z.number().min(0.01, 'Cena mora biti veća od 0'),
  })).min(1, 'Dodajte bar jednu stavku'),
});

export default function EditInvoice() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { selectedCompany } = useSelectedCompany();
  const { invoices, updateInvoice } = useInvoices(selectedCompany?.id || null);
  const { clients } = useClients(selectedCompany?.id || null);
  const { activeServices } = useServiceCatalog(selectedCompany?.id || null);
  const { getInstructionByCurrency } = useForeignPaymentInstructions(selectedCompany?.id || null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [openCatalogPopover, setOpenCatalogPopover] = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [cannotEdit, setCannotEdit] = useState<string | null>(null);
  const lastAppliedCurrencyRef = useRef<string | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    issue_date: '',
    service_date: '',
    client_id: '',
    client_name: '',
    client_address: '',
    client_city: '',
    client_country: '',
    client_pib: '',
    client_maticni_broj: '',
    client_vat_number: '',
    client_type: 'domestic' as 'domestic' | 'foreign',
    foreign_currency: '',
    foreign_amount: 0,
    exchange_rate: 0,
    payment_deadline: '',
    payment_method: 'Virman',
    note: '',
    invoice_type: 'regular' as InvoiceType,
    linked_advance_id: '',
  });

  // Find the invoice to edit
  const invoice = invoices.find(i => i.id === id);

  // Load invoice data
  useEffect(() => {
    const loadInvoiceData = async () => {
      if (!id || !invoice) {
        setLoadingData(false);
        return;
      }

      // Check if invoice can be edited
      const isProforma = invoice.is_proforma || invoice.invoice_type === 'proforma';
      const isAdvance = invoice.invoice_type === 'advance';

      if (isProforma) {
        // Check if proforma has been converted to invoice
        const createdInvoice = invoices.find(i => i.converted_from_proforma === invoice.id);
        if (createdInvoice) {
          setCannotEdit(`Ovaj predračun je već konvertovan u fakturu ${createdInvoice.invoice_number}`);
          setLoadingData(false);
          return;
        }
      }

      if (isAdvance && invoice.advance_status === 'closed') {
        setCannotEdit('Ova avansna faktura je već zatvorena i ne može se menjati');
        setLoadingData(false);
        return;
      }

      // Load form data from invoice
      // First try to get city/country from invoice itself, fallback to clients table
      let clientCity = invoice.client_city || '';
      let clientCountry = invoice.client_country || '';
      if (!clientCity && !clientCountry && invoice.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('city, country')
          .eq('id', invoice.client_id)
          .maybeSingle();
        clientCity = clientData?.city || '';
        clientCountry = clientData?.country || '';
      }

      setFormData({
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        service_date: invoice.service_date || '',
        client_id: invoice.client_id || '',
        client_name: invoice.client_name,
        client_address: invoice.client_address || '',
        client_city: clientCity,
        client_country: clientCountry,
        client_pib: invoice.client_pib || '',
        client_maticni_broj: invoice.client_maticni_broj || '',
        client_vat_number: (invoice as any).client_vat_number || '',
        client_type: invoice.client_type,
        foreign_currency: invoice.foreign_currency || '',
        foreign_amount: invoice.foreign_amount || 0,
        exchange_rate: invoice.exchange_rate || 0,
        payment_deadline: invoice.payment_deadline || '',
        payment_method: invoice.payment_method || 'Virman',
        note: invoice.note || '',
        invoice_type: invoice.invoice_type,
        linked_advance_id: invoice.linked_advance_id || '',
      });

      // Load invoice items
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id);

      if (invoiceItems && invoiceItems.length > 0) {
        setItems(invoiceItems.map(item => ({
          id: item.id,
          description: item.description,
          item_type: item.item_type as 'products' | 'services',
          quantity: item.quantity,
          unit_price: item.unit_price,
          foreign_amount: item.foreign_amount ? item.foreign_amount / item.quantity : 0,
        })));
      } else {
        // Fallback for invoices without items table entries
        setItems([{
          id: crypto.randomUUID(),
          description: invoice.description,
          item_type: invoice.item_type,
          quantity: invoice.quantity,
          unit_price: invoice.unit_price,
          foreign_amount: invoice.foreign_amount ? invoice.foreign_amount / invoice.quantity : 0,
        }]);
      }

      setLoadingData(false);
    };

    loadInvoiceData();
  }, [id, invoice, invoices]);

  // Calculate totals
  const itemTotals = items.map(item => item.quantity * item.unit_price);
  const totalAmount = itemTotals.reduce((sum, t) => sum + t, 0);
  const totalForeignAmount = items.reduce((sum, item) => sum + (item.foreign_amount * item.quantity), 0);
  const servicesTotal = items.filter(i => i.item_type === 'services').reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const productsTotal = items.filter(i => i.item_type === 'products').reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  // Determine place of service based on items - always use CITY + COUNTRY
  const getPlaceOfService = () => {
    const hasServices = items.some(i => i.item_type === 'services' && i.quantity > 0);
    const hasProducts = items.some(i => i.item_type === 'products' && i.quantity > 0);
    
    // Only services - use client city and country (for ALL clients, not just foreign)
    if (hasServices && !hasProducts) {
      const parts = [formData.client_city, formData.client_country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '';
    }
    
    // Products or mixed - use company city + country
    const companyParts = [selectedCompany?.city, selectedCompany?.country].filter(Boolean);
    return companyParts.length > 0 ? companyParts.join(', ') : (selectedCompany?.city || '');
  };

  // Determine invoice year from service_date or issue_date
  const getInvoiceYear = () => {
    if (formData.service_date) {
      return new Date(formData.service_date).getFullYear();
    }
    return new Date(formData.issue_date).getFullYear();
  };

  // Fetch NBS exchange rate when currency and date change
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (formData.client_type !== 'foreign' || !formData.foreign_currency || !formData.issue_date) {
        return;
      }

      setFetchingRate(true);
      setRateNote(null);

      try {
        const { data, error } = await supabase.functions.invoke('nbs-exchange-rate', {
          body: {
            currency: formData.foreign_currency,
            date: formData.issue_date,
          },
        });

        if (!error && data?.rate) {
          setFormData((prev) => ({
            ...prev,
            exchange_rate: data.rate,
          }));
          if (data.note) {
            setRateNote(data.note);
          }
        }
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
      } finally {
        setFetchingRate(false);
      }
    };

    fetchExchangeRate();
  }, [formData.foreign_currency, formData.issue_date, formData.client_type]);

  // Auto-calculate unit_price from foreign_amount * exchange_rate for each item (foreign clients)
  useEffect(() => {
    if (formData.client_type === 'foreign' && formData.exchange_rate > 0) {
      setItems(prev => prev.map(item => {
        if (item.foreign_amount > 0) {
          return {
            ...item,
            unit_price: Math.round(item.foreign_amount * formData.exchange_rate * 100) / 100,
          };
        }
        return item;
      }));
    }
  }, [formData.exchange_rate, formData.client_type]);

  // Auto-populate note with foreign payment instructions when currency changes
  useEffect(() => {
    // Only apply on EditInvoice if currency changes (not on initial load)
    if (!loadingData && formData.client_type === 'foreign' && formData.foreign_currency) {
      // Skip if we already applied this currency's instructions
      if (lastAppliedCurrencyRef.current === formData.foreign_currency) {
        return;
      }
      
      const instruction = getInstructionByCurrency(formData.foreign_currency);
      if (instruction) {
        const baseNote = 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.';
        const paymentSection = `\n\n--- Instrukcije za plaćanje (${formData.foreign_currency}) ---\n${instruction.instructions}`;
        setFormData(prev => ({ ...prev, note: baseNote + paymentSection }));
        lastAppliedCurrencyRef.current = formData.foreign_currency;
      }
    }
  }, [formData.client_type, formData.foreign_currency, getInstructionByCurrency, loadingData]);
  const handleClientSelect = (clientId: string) => {
    if (clientId === 'new') {
      setFormData((prev) => ({
        ...prev,
        client_id: '',
        client_name: '',
        client_address: '',
        client_city: '',
        client_country: '',
        client_pib: '',
        client_maticni_broj: '',
        client_vat_number: '',
        client_type: 'domestic',
      }));
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        client_id: client.id,
        client_name: client.name,
        client_address: client.address || '',
        client_city: client.city || '',
        client_country: client.country || '',
        client_pib: client.pib || '',
        client_maticni_broj: client.maticni_broj || '',
        client_vat_number: client.vat_number || '',
        client_type: client.client_type,
      }));
    }
  };

  // Item management
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

  const updateItem = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto-calculate unit_price when foreign_amount changes for foreign clients
      if (field === 'foreign_amount' && formData.client_type === 'foreign' && formData.exchange_rate > 0) {
        updated.unit_price = Math.round((value as number) * formData.exchange_rate * 100) / 100;
      }
      
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const result = invoiceSchema.safeParse({
      client_name: formData.client_name,
      service_date: formData.service_date,
      items: items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path.join('.')] = err.message;
        }
      });
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const invoiceYear = getInvoiceYear();
      
      // Determine main item type
      const mainItemType = servicesTotal >= productsTotal ? 'services' : 'products';

      // Update invoice
      await updateInvoice.mutateAsync({
        id: id!,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        service_date: formData.service_date || null,
        place_of_service: getPlaceOfService() || null,
        client_id: formData.client_id || null,
        client_name: formData.client_name,
        client_address: formData.client_address || null,
        client_city: formData.client_city || null,
        client_country: formData.client_country || null,
        client_pib: formData.client_pib || null,
        client_maticni_broj: formData.client_maticni_broj || null,
        client_vat_number: formData.client_type === 'foreign' ? formData.client_vat_number || null : null,
        client_type: formData.client_type,
        description: items.map(i => i.description).join('; '),
        quantity: 1,
        unit_price: totalAmount,
        total_amount: totalAmount,
        item_type: mainItemType,
        foreign_currency: formData.client_type === 'foreign' ? formData.foreign_currency || null : null,
        foreign_amount: formData.client_type === 'foreign' ? totalForeignAmount || null : null,
        exchange_rate: formData.client_type === 'foreign' ? formData.exchange_rate || null : null,
        payment_deadline: formData.payment_deadline || null,
        payment_method: formData.payment_method || null,
        note: formData.note || null,
        year: invoiceYear,
      } as any);

      // Delete old invoice items and insert new ones
      await supabase.from('invoice_items').delete().eq('invoice_id', id!);

      const itemsToInsert = items.map(item => ({
        invoice_id: id!,
        description: item.description,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.quantity * item.unit_price,
        foreign_amount: formData.client_type === 'foreign' && item.foreign_amount > 0 
          ? item.foreign_amount * item.quantity 
          : null,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update KPO entry for regular invoices
      if (formData.invoice_type === 'regular') {
        const productsAmount = items
          .filter((i) => i.item_type === 'products')
          .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

        const servicesAmount = items
          .filter((i) => i.item_type === 'services')
          .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

        const serviceDate = formData.service_date || formData.issue_date;
        const formattedDate = new Date(serviceDate).toLocaleDateString('sr-RS', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        // Update existing KPO entry
        const { error: kpoError } = await supabase
          .from('kpo_entries')
          .update({
            description: `Faktura ${formData.invoice_number}, ${formattedDate}, ${formData.client_name}`,
            products_amount: productsAmount,
            services_amount: servicesAmount,
            total_amount: totalAmount,
            year: invoiceYear,
            document_date: serviceDate,
          })
          .eq('invoice_id', id!);

        if (kpoError) {
          console.error('Error updating KPO entry:', kpoError);
        }
      }

      toast.success('Dokument uspešno ažuriran');
      navigate('/invoices');
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Greška pri ažuriranju dokumenta');
    }

    setLoading(false);
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste izmenili fakturu.</p>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Dokument nije pronađen</h1>
        <Button onClick={() => navigate('/invoices')}>Nazad na listu</Button>
      </div>
    );
  }

  if (cannotEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h1 className="text-2xl font-bold">Izmena nije dozvoljena</h1>
        <p className="text-muted-foreground">{cannotEdit}</p>
        <Button onClick={() => navigate('/invoices')}>Nazad na listu</Button>
      </div>
    );
  }

  const getTitle = () => {
    switch (formData.invoice_type) {
      case 'proforma': return 'Izmeni predračun';
      case 'advance': return 'Izmeni avansnu fakturu';
      default: return 'Izmeni fakturu';
    }
  };

  const currencies = ['EUR', 'USD', 'CHF', 'GBP'];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{getTitle()}</h1>
        <p className="text-muted-foreground">Za firmu: {selectedCompany.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Broj dokumenta</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue_date">Datum izdavanja</Label>
                <DateInput
                  id="issue_date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_date">Datum prometa *</Label>
                <DateInput
                  id="service_date"
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                  required
                />
                {errors.service_date && <p className="text-sm text-destructive">{errors.service_date}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="place_of_service">Mesto prometa</Label>
                <Input
                  id="place_of_service"
                  value={getPlaceOfService()}
                  readOnly
                  className="bg-muted"
                  title="Automatski se određuje: za usluge - mesto klijenta, za proizvode ili mešovito - mesto firme"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Podaci o primaocu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Izaberi postojećeg klijenta</Label>
              <Select value={formData.client_id || 'new'} onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberi klijenta ili unesi novog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Unesi novog klijenta</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} {client.client_type === 'foreign' && '(Strani)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Naziv / Ime *</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Naziv firme ili ime fizičkog lica"
                />
                {errors.client_name && <p className="text-sm text-destructive">{errors.client_name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_type">Tip klijenta</Label>
                <Select
                  value={formData.client_type}
                  onValueChange={(v: 'domestic' | 'foreign') => setFormData({ ...formData, client_type: v })}
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_address">Adresa</Label>
                <Input
                  id="client_address"
                  value={formData.client_address}
                  onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                  placeholder="Ulica i broj, Grad"
                />
              </div>
              {formData.client_type === 'domestic' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="client_pib">PIB</Label>
                    <Input
                      id="client_pib"
                      value={formData.client_pib}
                      onChange={(e) => setFormData({ ...formData, client_pib: e.target.value })}
                      placeholder="123456789"
                      maxLength={9}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_maticni_broj">Matični broj</Label>
                    <Input
                      id="client_maticni_broj"
                      value={formData.client_maticni_broj}
                      onChange={(e) => setFormData({ ...formData, client_maticni_broj: e.target.value })}
                      placeholder="12345678"
                      maxLength={8}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Stavke</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Dodaj stavku
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-muted-foreground">Stavka {index + 1}</span>
                  <div className="flex items-center gap-2">
                    {activeServices.length > 0 && (
                      <Popover 
                        open={openCatalogPopover === item.id} 
                        onOpenChange={(open) => setOpenCatalogPopover(open ? item.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <ListChecks className="h-4 w-4 mr-1" />
                            Iz šifarnika
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="end">
                          <Command>
                            <CommandInput placeholder="Pretraži šifarnik..." />
                            <CommandList>
                              <CommandEmpty>Nema rezultata.</CommandEmpty>
                              <CommandGroup>
                                {activeServices.map((service) => (
                                  <CommandItem
                                    key={service.id}
                                    value={service.name}
                                    onSelect={() => {
                                      const foreignAmt = formData.client_type === 'foreign' 
                                        ? (service.default_foreign_price || 0) 
                                        : 0;
                                      
                                      const unitPrice = formData.client_type === 'foreign' && formData.exchange_rate > 0
                                        ? foreignAmt * formData.exchange_rate
                                        : (service.default_unit_price || 0);
                                      
                                      updateItem(item.id, 'description', service.name + (service.description ? ` - ${service.description}` : ''));
                                      updateItem(item.id, 'item_type', service.item_type);
                                      updateItem(item.id, 'unit_price', unitPrice);
                                      updateItem(item.id, 'foreign_amount', foreignAmt);
                                      setOpenCatalogPopover(null);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span>{service.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {service.item_type === 'services' ? 'Usluga' : 'Proizvod'}
                                        {service.default_unit_price && ` • ${new Intl.NumberFormat('sr-RS').format(service.default_unit_price)} RSD`}
                                        {service.default_foreign_price && ` • ${service.default_foreign_price} DEV`}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                    {items.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className={`grid grid-cols-1 gap-4 ${formData.client_type === 'foreign' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                  <div className="space-y-2">
                    <Label>Tip</Label>
                    <Select
                      value={item.item_type}
                      onValueChange={(v: 'products' | 'services') => updateItem(item.id, 'item_type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="services">Usluge</SelectItem>
                        <SelectItem value="products">Proizvodi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Količina</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="1"
                    />
                  </div>
                  {formData.client_type === 'foreign' && (
                    <div className="space-y-2">
                      <Label>Iznos ({formData.foreign_currency || 'DEV'})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.foreign_amount || ''}
                        onChange={(e) => updateItem(item.id, 'foreign_amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Cena (RSD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      readOnly={formData.client_type === 'foreign'}
                      className={formData.client_type === 'foreign' ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Iznos (RSD)</Label>
                    <Input
                      type="text"
                      value={new Intl.NumberFormat('sr-RS').format(item.quantity * item.unit_price)}
                      readOnly
                      className="bg-muted font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Opis</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Opis usluge ili proizvoda"
                    rows={2}
                  />
                  {errors[`items.${index}.description`] && (
                    <p className="text-sm text-destructive">{errors[`items.${index}.description`]}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Foreign currency section */}
            {formData.client_type === 'foreign' && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Valuta</Label>
                    <Select
                      value={formData.foreign_currency}
                      onValueChange={(v) => setFormData({ ...formData, foreign_currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberi valutu" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((curr) => (
                          <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kurs NBS</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.exchange_rate || ''}
                        onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="0.0000"
                      />
                      {fetchingRate && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {rateNote && <p className="text-xs text-muted-foreground">{rateNote}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Ukupno ({formData.foreign_currency || 'DEV'})</Label>
                    <Input
                      type="text"
                      value={totalForeignAmount.toFixed(2)}
                      readOnly
                      className="bg-muted font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="flex flex-col items-end gap-2 pt-4 border-t">
              <div className="text-lg">
                <span className="text-muted-foreground">Ukupno: </span>
                <span className="font-bold">{new Intl.NumberFormat('sr-RS').format(totalAmount)} RSD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Podaci o plaćanju</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_deadline">Rok plaćanja</Label>
                <DateInput
                  id="payment_deadline"
                  value={formData.payment_deadline}
                  onChange={(e) => setFormData({ ...formData, payment_deadline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Način plaćanja</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Virman">Virman</SelectItem>
                    <SelectItem value="Gotovina">Gotovina</SelectItem>
                    <SelectItem value="Kartica">Kartica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Napomena</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            Otkaži
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Sačuvaj izmene
          </Button>
        </div>
      </form>
    </div>
  );
}

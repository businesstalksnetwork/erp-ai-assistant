import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices, InvoiceType } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useInvoiceTemplates, InvoiceTemplate } from '@/hooks/useInvoiceTemplates';
import { useForeignPaymentInstructions } from '@/hooks/useForeignPaymentInstructions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
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
import { Building2, Loader2, Save, Plus, Trash2, Link as LinkIcon, ListChecks, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const currencies = ['EUR', 'USD', 'CHF', 'GBP'];

export default function NewInvoice() {
  const navigate = useNavigate();
  const { selectedCompany } = useSelectedCompany();
  const { createInvoice, closeAdvanceInvoice, getOpenAdvances, invoices } = useInvoices(selectedCompany?.id || null);
  const { clients } = useClients(selectedCompany?.id || null);
  const { activeServices } = useServiceCatalog(selectedCompany?.id || null);
  const { templates, getTemplatesByType } = useInvoiceTemplates(selectedCompany?.id || null);
  const { getInstructionByCurrency } = useForeignPaymentInstructions(selectedCompany?.id || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [openCatalogPopover, setOpenCatalogPopover] = useState<string | null>(null);
  const [openClientPopover, setOpenClientPopover] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const lastAppliedCurrencyRef = useRef<string | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: '', item_type: 'services', quantity: 1, unit_price: 0, foreign_amount: 0 }
  ]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    service_date: new Date().toISOString().split('T')[0],
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
    note: 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.',
    invoice_type: 'regular' as InvoiceType,
    linked_advance_id: '',
  });

  // Get open advances for current client
  const openAdvances = getOpenAdvances(formData.client_id || null);
  const linkedAdvance = formData.linked_advance_id 
    ? invoices.find(i => i.id === formData.linked_advance_id) 
    : null;

  // Calculate totals
  const itemTotals = items.map(item => item.quantity * item.unit_price);
  const totalAmount = itemTotals.reduce((sum, t) => sum + t, 0);
  const totalForeignAmount = items.reduce((sum, item) => sum + (item.foreign_amount * item.quantity), 0);
  const servicesTotal = items.filter(i => i.item_type === 'services').reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const productsTotal = items.filter(i => i.item_type === 'products').reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  
  // Determine place of service based on items - always use CITY only
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

  // Amount for payment (total minus advance)
  const advanceAmount = linkedAdvance?.total_amount || 0;
  const amountForPayment = totalAmount - advanceAmount;

  // Determine invoice year from service_date or issue_date
  const getInvoiceYear = () => {
    if (formData.service_date) {
      return new Date(formData.service_date).getFullYear();
    }
    return new Date(formData.issue_date).getFullYear();
  };

  // Generate invoice number from database based on issue_date or service_date year and invoice type
  useEffect(() => {
    const fetchNextNumber = async () => {
      if (selectedCompany) {
        const invoiceYear = getInvoiceYear();
        const { data, error } = await supabase.rpc('get_next_invoice_number_by_type', {
          p_company_id: selectedCompany.id,
          p_year: invoiceYear,
          p_invoice_type: formData.invoice_type,
        });
        
        if (!error && data) {
          setFormData((prev) => ({
            ...prev,
            invoice_number: data,
          }));
        }
      }
    };
    fetchNextNumber();
  }, [selectedCompany, formData.invoice_type, formData.service_date, formData.issue_date]);

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

  // Clear linked advance when changing invoice type or client
  useEffect(() => {
    if (formData.invoice_type !== 'regular') {
      setFormData(prev => ({ ...prev, linked_advance_id: '' }));
    }
  }, [formData.invoice_type]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, linked_advance_id: '' }));
  }, [formData.client_id]);

  // Auto-populate note with foreign payment instructions when currency changes
  useEffect(() => {
    if (formData.client_type === 'foreign' && formData.foreign_currency) {
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
    } else {
      // Reset tracking when switching away from foreign
      lastAppliedCurrencyRef.current = null;
    }
  }, [formData.client_type, formData.foreign_currency, getInstructionByCurrency]);

  // Fill client data when selected
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

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Fill client data from template
    setFormData(prev => ({
      ...prev,
      client_id: template.client_id || '',
      client_name: template.client_name,
      client_address: template.client_address || '',
      client_pib: template.client_pib || '',
      client_maticni_broj: template.client_maticni_broj || '',
      client_vat_number: (template as any).client_vat_number || '',
      client_type: template.client_type as 'domestic' | 'foreign',
      foreign_currency: template.foreign_currency || '',
      exchange_rate: 0, // Reset - will be fetched fresh
      payment_method: template.payment_method || 'Virman',
      note: template.note || 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.',
      // Keep dates as today
      issue_date: new Date().toISOString().split('T')[0],
      service_date: '',
    }));

    // Fill items from template
    setItems(template.items.map(item => ({
      id: crypto.randomUUID(),
      description: item.description,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      foreign_amount: item.foreign_amount || 0,
    })));
  };

  // Get templates for current invoice type
  const templatesForType = getTemplatesByType(formData.invoice_type as 'regular' | 'proforma' | 'advance');

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

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
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
      const isProforma = formData.invoice_type === 'proforma';
      const isAdvance = formData.invoice_type === 'advance';
      
      // If new client (no client_id), save to clients table first
      let clientId = formData.client_id || null;
      if (!formData.client_id && formData.client_name.trim()) {
        const existingClient = clients.find(
          c => c.name.toLowerCase() === formData.client_name.trim().toLowerCase()
        );
        
        if (!existingClient) {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              company_id: selectedCompany!.id,
              name: formData.client_name.trim(),
              address: formData.client_address || null,
              pib: formData.client_pib || null,
              client_type: formData.client_type,
            })
            .select()
            .single();
          
          if (!clientError && newClient) {
            clientId = newClient.id;
          }
        } else {
          clientId = existingClient.id;
        }
      }

      // Determine main item type (for backwards compatibility)
      const mainItemType = servicesTotal >= productsTotal ? 'services' : 'products';
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: selectedCompany!.id,
          invoice_number: formData.invoice_number,
          issue_date: formData.issue_date,
          service_date: formData.service_date || null,
          place_of_service: getPlaceOfService() || null,
          client_id: clientId,
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
          is_proforma: isProforma,
          converted_from_proforma: null,
          year: invoiceYear,
          invoice_type: formData.invoice_type,
          linked_advance_id: formData.linked_advance_id || null,
          advance_status: isAdvance ? 'open' : null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const itemsToInsert = items.map(item => ({
        invoice_id: invoice.id,
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

      // Close the linked advance invoice if one was selected
      if (formData.linked_advance_id) {
        await closeAdvanceInvoice.mutateAsync(formData.linked_advance_id);
      }

      // Create/Update KPO entry for regular invoices only (not proforma, not advance)
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

        // If a KPO row was already created (e.g. via backend automation), update it instead of inserting a duplicate.
        const { data: existingKpo } = await supabase
          .from('kpo_entries')
          .select('id, ordinal_number')
          .eq('invoice_id', invoice.id)
          .maybeSingle();

        let ordinalNumber = existingKpo?.ordinal_number;

        if (!ordinalNumber) {
          const { data: maxOrdinal } = await supabase
            .from('kpo_entries')
            .select('ordinal_number')
            .eq('company_id', selectedCompany!.id)
            .eq('year', invoiceYear)
            .order('ordinal_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          ordinalNumber = (maxOrdinal?.ordinal_number || 0) + 1;
        }

        const kpoPayload = {
          company_id: selectedCompany!.id,
          invoice_id: invoice.id,
          ordinal_number: ordinalNumber,
          description: `Faktura ${formData.invoice_number}, ${formattedDate}, ${formData.client_name}`,
          products_amount: productsAmount,
          services_amount: servicesAmount,
          total_amount: totalAmount,
          year: invoiceYear,
          document_date: serviceDate,
        };

        const { error: kpoError } = existingKpo
          ? await supabase.from('kpo_entries').update(kpoPayload).eq('id', existingKpo.id)
          : await supabase.from('kpo_entries').insert(kpoPayload);

        if (kpoError) {
          console.error('Error creating/updating KPO entry:', kpoError);
          toast.error('Faktura je kreirana, ali KPO nije ažuriran');
        }
      }

      const typeLabel = formData.invoice_type === 'proforma' 
        ? 'Predračun' 
        : formData.invoice_type === 'advance' 
          ? 'Avansna faktura' 
          : 'Faktura';
      toast.success(`${typeLabel} uspešno kreirana`);
      navigate('/invoices');
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Greška pri kreiranju fakture');
    }

    setLoading(false);
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste kreirali fakturu.</p>
      </div>
    );
  }

  const getTitle = () => {
    switch (formData.invoice_type) {
      case 'proforma': return 'Novi predračun';
      case 'advance': return 'Nova avansna faktura';
      default: return 'Nova faktura';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{getTitle()}</h1>
        <p className="text-muted-foreground">Za firmu: {selectedCompany.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Type Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Tip dokumenta</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.invoice_type}
              onValueChange={(value: InvoiceType) => setFormData({ ...formData, invoice_type: value })}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="regular" id="regular" className="mt-1" />
                <div>
                  <Label htmlFor="regular" className="font-medium cursor-pointer">Faktura</Label>
                  <p className="text-sm text-muted-foreground">Standardna faktura, evidentira se u KPO knjizi</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="proforma" id="proforma" className="mt-1" />
                <div>
                  <Label htmlFor="proforma" className="font-medium cursor-pointer">Predračun</Label>
                  <p className="text-sm text-muted-foreground">Ne evidentira se u KPO knjizi</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="advance" id="advance" className="mt-1" />
                <div>
                  <Label htmlFor="advance" className="font-medium cursor-pointer">Avansna faktura</Label>
                  <p className="text-sm text-muted-foreground">Za avansna plaćanja, ne ide u KPO</p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Template Selection */}
        {templatesForType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Šablon</CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite šablon za brže popunjavanje (opciono)" />
                </SelectTrigger>
                <SelectContent>
                  {templatesForType.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Šablon će popuniti podatke o klijentu i stavke, a datumi ostaju današnji.
              </p>
            </CardContent>
          </Card>
        )}

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
              <Popover open={openClientPopover} onOpenChange={setOpenClientPopover}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    aria-expanded={openClientPopover}
                    className="w-full justify-between font-normal"
                  >
                    {formData.client_id && formData.client_id !== 'new'
                      ? clients.find(c => c.id === formData.client_id)?.name || 'Izaberi klijenta'
                      : 'Izaberi klijenta ili unesi novog'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pretraži klijente..." />
                    <CommandList>
                      <CommandEmpty>Nema rezultata</CommandEmpty>
                      <CommandGroup>
                        <CommandItem 
                          onSelect={() => {
                            handleClientSelect('new');
                            setOpenClientPopover(false);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Unesi novog klijenta
                        </CommandItem>
                        {clients.map((client) => (
                          <CommandItem 
                            key={client.id}
                            value={client.name}
                            onSelect={() => {
                              handleClientSelect(client.id);
                              setOpenClientPopover(false);
                            }}
                          >
                            <Check className={cn(
                              "mr-2 h-4 w-4",
                              formData.client_id === client.id ? "opacity-100" : "opacity-0"
                            )} />
                            {client.name} {client.client_type === 'foreign' && '(Strani)'}
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

        {/* Link Advance Invoice - Only for regular invoices */}
        {formData.invoice_type === 'regular' && formData.client_id && openAdvances.length > 0 && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Poveži avansnu fakturu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Otvorene avansne fakture za ovog klijenta</Label>
                <Select 
                  value={formData.linked_advance_id || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, linked_advance_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberi avansnu fakturu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez avansne fakture</SelectItem>
                    {openAdvances.map((adv) => (
                      <SelectItem key={adv.id} value={adv.id}>
                        {adv.invoice_number} - {new Intl.NumberFormat('sr-RS').format(adv.total_amount)} RSD
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {linkedAdvance && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Avansno uplaćeno:</strong> {new Intl.NumberFormat('sr-RS').format(linkedAdvance.total_amount)} RSD</p>
                  <p className="text-muted-foreground">Ova avansna faktura će biti zatvorena nakon kreiranja fakture.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                                      const price = formData.client_type === 'foreign' && service.default_foreign_price
                                        ? service.default_foreign_price
                                        : service.default_unit_price || 0;
                                      
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
                    <Label>Ukupno</Label>
                    <div className="h-10 px-3 py-2 rounded-md border bg-muted font-medium">
                      {new Intl.NumberFormat('sr-RS').format(item.quantity * item.unit_price)} RSD
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Opis *</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Opis pružene usluge ili isporučenih dobara"
                    rows={2}
                  />
                  {errors[`items.${index}.description`] && (
                    <p className="text-sm text-destructive">{errors[`items.${index}.description`]}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="border-t pt-4 mt-4">
              <div className="flex flex-col gap-2 items-end">
                {productsTotal > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Proizvodi: {new Intl.NumberFormat('sr-RS').format(productsTotal)} RSD
                  </div>
                )}
                {servicesTotal > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Usluge: {new Intl.NumberFormat('sr-RS').format(servicesTotal)} RSD
                  </div>
                )}
                <div className="text-xl font-bold">
                  Ukupno: {new Intl.NumberFormat('sr-RS').format(totalAmount)} RSD
                </div>
                {linkedAdvance && (
                  <>
                    <div className="text-sm text-primary">
                      Avansno uplaćeno: -{new Intl.NumberFormat('sr-RS').format(advanceAmount)} RSD
                    </div>
                    <div className="text-xl font-bold text-primary">
                      Za uplatu: {new Intl.NumberFormat('sr-RS').format(amountForPayment)} RSD
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Foreign Currency Fields */}
            {formData.client_type === 'foreign' && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-4">Iznos u stranoj valuti (automatski kurs NBS)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="foreign_currency">Valuta</Label>
                    <Select
                      value={formData.foreign_currency}
                      onValueChange={(v) => setFormData({ ...formData, foreign_currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberi valutu" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foreign_amount">Iznos u valuti</Label>
                    <Input
                      id="foreign_amount"
                      type="number"
                      step="0.01"
                      value={formData.foreign_amount || ''}
                      onChange={(e) => setFormData({ ...formData, foreign_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="1000.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchange_rate" className="flex items-center gap-2">
                      Kurs NBS
                      {fetchingRate && <Loader2 className="h-3 w-3 animate-spin" />}
                    </Label>
                    <Input
                      id="exchange_rate"
                      type="number"
                      step="0.0001"
                      value={formData.exchange_rate || ''}
                      onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 0 })}
                      placeholder="117.1234"
                      className={fetchingRate ? 'opacity-50' : ''}
                    />
                    {rateNote && (
                      <p className="text-xs text-muted-foreground">{rateNote}</p>
                    )}
                  </div>
                </div>
                {formData.foreign_amount > 0 && formData.exchange_rate > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {formData.foreign_amount} {formData.foreign_currency} × {formData.exchange_rate} = {new Intl.NumberFormat('sr-RS').format(formData.foreign_amount * formData.exchange_rate)} RSD
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Plaćanje</CardTitle>
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
                <Input
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="Virman, gotovina..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Napomena</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            Otkaži
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Sačuvaj {formData.invoice_type === 'proforma' ? 'predračun' : formData.invoice_type === 'advance' ? 'avansnu fakturu' : 'fakturu'}
          </Button>
        </div>
      </form>
    </div>
  );
}

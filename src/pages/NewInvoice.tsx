import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, Save } from 'lucide-react';
import { z } from 'zod';

const invoiceSchema = z.object({
  client_name: z.string().min(2, 'Naziv klijenta je obavezan'),
  description: z.string().min(2, 'Opis je obavezan'),
  quantity: z.number().min(0.01, 'Količina mora biti veća od 0'),
  unit_price: z.number().min(0.01, 'Cena mora biti veća od 0'),
});

const currencies = ['EUR', 'USD', 'CHF', 'GBP'];

export default function NewInvoice() {
  const navigate = useNavigate();
  const { selectedCompany } = useSelectedCompany();
  const { invoices, createInvoice } = useInvoices(selectedCompany?.id || null);
  const { clients } = useClients(selectedCompany?.id || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    service_date: '',
    client_id: '',
    client_name: '',
    client_address: '',
    client_pib: '',
    client_type: 'domestic' as 'domestic' | 'foreign',
    description: '',
    quantity: 1,
    unit_price: 0,
    item_type: 'services' as 'products' | 'services',
    foreign_currency: '',
    foreign_amount: 0,
    exchange_rate: 0,
    payment_deadline: '',
    payment_method: 'Virman',
    note: 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.',
    is_proforma: false,
  });

  // Generate invoice number
  useEffect(() => {
    if (selectedCompany) {
      const currentYear = new Date().getFullYear();
      const prefix = formData.is_proforma ? 'PR-' : '';
      const relevantInvoices = invoices.filter(
        (i) => i.year === currentYear && i.is_proforma === formData.is_proforma
      );
      const nextNumber = relevantInvoices.length + 1;
      setFormData((prev) => ({
        ...prev,
        invoice_number: `${prefix}${nextNumber}/${currentYear}`,
      }));
    }
  }, [selectedCompany, invoices, formData.is_proforma]);

  // Fill client data when selected
  const handleClientSelect = (clientId: string) => {
    if (clientId === 'new') {
      setFormData((prev) => ({
        ...prev,
        client_id: '',
        client_name: '',
        client_address: '',
        client_pib: '',
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
        client_pib: client.pib || '',
        client_type: client.client_type,
      }));
    }
  };

  const totalAmount = formData.quantity * formData.unit_price;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const result = invoiceSchema.safeParse({
      client_name: formData.client_name,
      description: formData.description,
      quantity: formData.quantity,
      unit_price: formData.unit_price,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      await createInvoice.mutateAsync({
        company_id: selectedCompany!.id,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        service_date: formData.service_date || null,
        client_id: formData.client_id || null,
        client_name: formData.client_name,
        client_address: formData.client_address || null,
        client_pib: formData.client_pib || null,
        client_type: formData.client_type,
        description: formData.description,
        quantity: formData.quantity,
        unit_price: formData.unit_price,
        total_amount: totalAmount,
        item_type: formData.item_type,
        foreign_currency: formData.client_type === 'foreign' ? formData.foreign_currency || null : null,
        foreign_amount: formData.client_type === 'foreign' ? formData.foreign_amount || null : null,
        exchange_rate: formData.client_type === 'foreign' ? formData.exchange_rate || null : null,
        payment_deadline: formData.payment_deadline || null,
        payment_method: formData.payment_method || null,
        note: formData.note || null,
        is_proforma: formData.is_proforma,
        converted_from_proforma: null,
        year: new Date().getFullYear(),
      });
      navigate('/invoices');
    } catch (error) {
      console.error('Error creating invoice:', error);
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

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">
          {formData.is_proforma ? 'Novi predračun' : 'Nova faktura'}
        </h1>
        <p className="text-muted-foreground">Za firmu: {selectedCompany.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Type Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_proforma" className="text-base font-medium">
                  Predračun
                </Label>
                <p className="text-sm text-muted-foreground">
                  Predračuni se ne evidentiraju u KPO knjizi niti u limitima
                </p>
              </div>
              <Switch
                id="is_proforma"
                checked={formData.is_proforma}
                onCheckedChange={(checked) => setFormData({ ...formData, is_proforma: checked })}
              />
            </div>
          </CardContent>
        </Card>

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
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_date">Datum prometa</Label>
                <Input
                  id="service_date"
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardHeader>
            <CardTitle>Stavka</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item_type">Tip stavke</Label>
              <Select
                value={formData.item_type}
                onValueChange={(v: 'products' | 'services') => setFormData({ ...formData, item_type: v })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="services">Usluge</SelectItem>
                  <SelectItem value="products">Proizvodi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis dobara ili usluga *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opis pružene usluge ili isporučenih dobara"
                rows={3}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Količina</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                />
                {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Jedinična cena (RSD)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                />
                {errors.unit_price && <p className="text-sm text-destructive">{errors.unit_price}</p>}
              </div>
              <div className="space-y-2">
                <Label>Ukupno (RSD)</Label>
                <div className="h-10 px-3 py-2 bg-secondary rounded-md font-semibold">
                  {new Intl.NumberFormat('sr-RS').format(totalAmount)} RSD
                </div>
              </div>
            </div>

            {/* Foreign Currency Fields */}
            {formData.client_type === 'foreign' && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-4">Iznos u stranoj valuti</p>
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
                      value={formData.foreign_amount}
                      onChange={(e) => setFormData({ ...formData, foreign_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchange_rate">Kurs NBS</Label>
                    <Input
                      id="exchange_rate"
                      type="number"
                      step="0.0001"
                      value={formData.exchange_rate}
                      onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 0 })}
                      placeholder="117.1234"
                    />
                  </div>
                </div>
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
                <Input
                  id="payment_deadline"
                  type="date"
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
            Sačuvaj {formData.is_proforma ? 'predračun' : 'fakturu'}
          </Button>
        </div>
      </form>
    </div>
  );
}

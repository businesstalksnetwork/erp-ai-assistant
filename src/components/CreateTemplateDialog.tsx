import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Loader2 } from 'lucide-react';
import { useInvoiceTemplates, TemplateItem } from '@/hooks/useInvoiceTemplates';

interface Invoice {
  id: string;
  invoice_type: 'regular' | 'proforma' | 'advance';
  client_id: string | null;
  client_name: string;
  client_address: string | null;
  client_pib: string | null;
  client_maticni_broj: string | null;
  client_vat_number?: string | null;
  client_type: 'domestic' | 'foreign';
  foreign_currency: string | null;
  payment_method: string | null;
  note: string | null;
}

interface InvoiceItem {
  id: string;
  description: string;
  item_type: 'products' | 'services';
  quantity: number;
  unit_price: number;
  foreign_amount?: number;
}

interface CreateTemplateDialogProps {
  invoice: Invoice;
  items: InvoiceItem[];
  companyId: string;
}

export function CreateTemplateDialog({ invoice, items, companyId }: CreateTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { createTemplate } = useInvoiceTemplates(companyId);

  const handleSave = async () => {
    if (!name.trim()) return;

    // Convert items to template format
    const templateItems: TemplateItem[] = items.map(item => ({
      description: item.description,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      foreign_amount: item.foreign_amount || 0,
    }));

    await createTemplate.mutateAsync({
      company_id: companyId,
      name: name.trim(),
      invoice_type: invoice.invoice_type,
      client_id: invoice.client_id,
      client_name: invoice.client_name,
      client_address: invoice.client_address,
      client_pib: invoice.client_pib,
      client_maticni_broj: invoice.client_maticni_broj,
      client_vat_number: invoice.client_vat_number,
      client_type: invoice.client_type,
      foreign_currency: invoice.foreign_currency,
      items: templateItems,
      payment_method: invoice.payment_method,
      note: invoice.note,
    });

    setName('');
    setOpen(false);
  };

  const getDocumentTypeName = () => {
    switch (invoice.invoice_type) {
      case 'advance': return 'avansne fakture';
      case 'proforma': return 'predračuna';
      default: return 'fakture';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Napravi šablon
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sačuvaj kao šablon</DialogTitle>
          <DialogDescription>
            Sačuvajte podatke ove {getDocumentTypeName()} kao šablon za brže kreiranje novih dokumenata.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Naziv šablona</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`npr. Mesečna ${invoice.invoice_type === 'regular' ? 'faktura' : invoice.invoice_type === 'proforma' ? 'predračun' : 'avansna'} - ${invoice.client_name}`}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Šablon će sadržati:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Podaci o klijentu: {invoice.client_name}</li>
              <li>Broj stavki: {items.length}</li>
              {invoice.foreign_currency && (
                <li>Valuta: {invoice.foreign_currency}</li>
              )}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Odustani
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sačuvaj šablon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

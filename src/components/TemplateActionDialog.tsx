import { useNavigate } from 'react-router-dom';
import { InvoiceTemplate } from '@/hooks/useInvoiceTemplates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Pencil, Trash2, Plus } from 'lucide-react';

interface TemplateActionDialogProps {
  template: InvoiceTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export function TemplateActionDialog({
  template,
  open,
  onOpenChange,
  onDelete,
  isDeleting = false,
}: TemplateActionDialogProps) {
  const navigate = useNavigate();

  if (!template) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'regular': return 'Faktura';
      case 'proforma': return 'Predračun';
      case 'advance': return 'Avans';
      default: return type;
    }
  };

  const handleCreateNew = () => {
    onOpenChange(false);
    navigate(`/invoices/new?template=${template.id}`);
  };

  const handleEdit = () => {
    onOpenChange(false);
    navigate(`/templates/${template.id}/edit`);
  };

  const handleDelete = () => {
    onDelete(template.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {template.name}
          </DialogTitle>
          <DialogDescription>
            Izaberite akciju za ovaj šablon
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tip:</span>
              <Badge variant="outline">{getTypeLabel(template.invoice_type)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Klijent:</span>
              <span className="font-medium text-right max-w-[200px] truncate">{template.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stavki:</span>
              <span>{template.items.length}</span>
            </div>
            {template.foreign_currency && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valuta:</span>
                <span>{template.foreign_currency}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleCreateNew} className="w-full justify-start">
              <Plus className="mr-2 h-4 w-4" />
              Kreiraj novi dokument
            </Button>
            <Button onClick={handleEdit} variant="outline" className="w-full justify-start">
              <Pencil className="mr-2 h-4 w-4" />
              Izmeni šablon
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="w-full justify-start"
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Brisanje...' : 'Obriši šablon'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

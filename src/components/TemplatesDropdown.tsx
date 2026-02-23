import { useState } from 'react';
import { useInvoiceTemplates, InvoiceTemplate } from '@/hooks/useInvoiceTemplates';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText } from 'lucide-react';
import { TemplateActionDialog } from './TemplateActionDialog';

interface TemplatesDropdownProps {
  companyId: string | null;
}

export function TemplatesDropdown({ companyId }: TemplatesDropdownProps) {
  const { templates, getTemplatesByType, deleteTemplate } = useInvoiceTemplates(companyId);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const regularTemplates = getTemplatesByType('regular');
  const advanceTemplates = getTemplatesByType('advance');
  const proformaTemplates = getTemplatesByType('proforma');

  const handleTemplateClick = (template: InvoiceTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync(id);
    setDialogOpen(false);
    setSelectedTemplate(null);
  };

  if (templates.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <FileText className="mr-2 h-4 w-4" />
            Šabloni
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span>Faktura</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {regularTemplates.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Nema šablona
                </DropdownMenuItem>
              ) : (
                regularTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <span className="truncate">{template.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span>Avans</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {advanceTemplates.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Nema šablona
                </DropdownMenuItem>
              ) : (
                advanceTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <span className="truncate">{template.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span>Predračun</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {proformaTemplates.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Nema šablona
                </DropdownMenuItem>
              ) : (
                proformaTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <span className="truncate">{template.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <TemplateActionDialog
        template={selectedTemplate}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDelete={handleDelete}
        isDeleting={deleteTemplate.isPending}
      />
    </>
  );
}

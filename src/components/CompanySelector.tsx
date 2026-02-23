import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Company } from '@/hooks/useCompanies';

interface CompanySelectorProps {
  selectedCompany: Company | null;
  myCompanies: Company[];
  clientCompanies: Company[];
  onSelect: (company: Company) => void;
}

export function CompanySelector({
  selectedCompany,
  myCompanies,
  clientCompanies,
  onSelect,
}: CompanySelectorProps) {
  const [open, setOpen] = useState(false);

  const allCompanies = [...myCompanies, ...clientCompanies];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-sidebar-accent border-sidebar-border text-sidebar-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
        >
          <span className="truncate">
            {selectedCompany?.name || 'Izaberi firmu'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pretraži firme..." />
          <CommandList>
            <CommandEmpty>Nema rezultata.</CommandEmpty>
            {myCompanies.length > 0 && (
              <CommandGroup heading="Moje firme">
                {myCompanies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`my-${company.name}`}
                    onSelect={() => {
                      onSelect(company);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedCompany?.id === company.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{company.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {clientCompanies.length > 0 && (
              <CommandGroup heading="Firme klijenata">
                {clientCompanies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`client-${company.name}-${company.client_name}`}
                    onSelect={() => {
                      onSelect(company);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedCompany?.id === company.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{company.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        ({company.client_name})
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

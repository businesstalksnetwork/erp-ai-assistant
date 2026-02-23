import { useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MobileFilterBarProps {
  /** Filters to show - rendered as-is on desktop, collapsed on mobile */
  filters: ReactNode;
  /** Action buttons (e.g., "New Invoice") */
  actions?: ReactNode;
  /** Search input element */
  search?: ReactNode;
}

export function MobileFilterBar({ filters, actions, search }: MobileFilterBarProps) {
  const isMobile = useIsMobile();
  const [filterOpen, setFilterOpen] = useState(false);

  if (!isMobile) {
    // Desktop: horizontal row
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {search && <div className="flex-1 min-w-[200px] max-w-sm">{search}</div>}
        {filters}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    );
  }

  // Mobile: search full-width, filters in popover
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {search && <div className="flex-1">{search}</div>}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="end">
            {filters}
          </PopoverContent>
        </Popover>
        {actions}
      </div>
    </div>
  );
}

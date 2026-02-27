import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  available: string[];
  selected: string[];
  onAdd: (dim: string) => void;
  onRemove: (dim: string) => void;
  label: string;
}

export function DimensionPicker({ available, selected, onAdd, onRemove, label }: Props) {
  const unselected = available.filter((d) => !selected.includes(d));

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {selected.map((dim) => (
          <Badge key={dim} variant="secondary" className="gap-1 pr-1">
            {dim.replace(/_/g, " ")}
            <button onClick={() => onRemove(dim)} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {unselected.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />+
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <ScrollArea className="max-h-48">
                {unselected.map((dim) => (
                  <button
                    key={dim}
                    onClick={() => onAdd(dim)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                  >
                    {dim.replace(/_/g, " ")}
                  </button>
                ))}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

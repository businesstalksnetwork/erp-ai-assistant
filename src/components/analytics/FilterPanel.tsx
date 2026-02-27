import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface Props {
  dimensions: string[];
  filters: Record<string, string[]>;
  onSetFilter: (key: string, values: string[]) => void;
  onClear: () => void;
}

export function FilterPanel({ dimensions, filters, onSetFilter, onClear }: Props) {
  const [addKey, setAddKey] = useState("");
  const [addValue, setAddValue] = useState("");

  const activeKeys = Object.keys(filters);

  const handleAddValue = () => {
    if (!addKey || !addValue.trim()) return;
    const existing = filters[addKey] || [];
    if (!existing.includes(addValue.trim())) {
      onSetFilter(addKey, [...existing, addValue.trim()]);
    }
    setAddValue("");
  };

  const removeFilterValue = (key: string, val: string) => {
    const remaining = (filters[key] || []).filter((v) => v !== val);
    onSetFilter(key, remaining);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filteri</div>
        {activeKeys.length > 0 && (
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-muted-foreground" onClick={onClear}>
            Obriši sve
          </Button>
        )}
      </div>

      {activeKeys.map((key) => (
        <div key={key} className="space-y-1">
          <div className="text-xs text-muted-foreground">{key.replace(/_/g, " ")}</div>
          <div className="flex flex-wrap gap-1">
            {filters[key].map((val) => (
              <Badge key={val} variant="outline" className="gap-1 pr-1 text-xs">
                {val}
                <button onClick={() => removeFilterValue(key, val)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs w-full">
            <Filter className="h-3 w-3 mr-1" /> Dodaj filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 space-y-2" align="start">
          <select
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            className="w-full h-8 text-xs border rounded px-2 bg-background"
          >
            <option value="">Dimenzija...</option>
            {dimensions.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
            ))}
          </select>
          {addKey && (
            <div className="flex gap-1">
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="Vrednost..."
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAddValue()}
              />
              <Button size="sm" className="h-8 px-2" onClick={handleAddValue}>+</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

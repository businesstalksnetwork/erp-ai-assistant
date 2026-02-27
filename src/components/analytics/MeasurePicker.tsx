import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import type { MeasureConfig } from "@/hooks/usePivotConfig";

interface MeasureDef {
  col: string;
  label: string;
  aggs: string[];
}

interface Props {
  available: MeasureDef[];
  selected: MeasureConfig[];
  onAdd: (m: MeasureConfig) => void;
  onRemove: (alias: string) => void;
}

const AGG_LABELS: Record<string, string> = {
  sum: "SUM", avg: "AVG", min: "MIN", max: "MAX", count: "COUNT", count_distinct: "DISTINCT",
};

export function MeasurePicker({ available, selected, onAdd, onRemove }: Props) {
  const [pickCol, setPickCol] = useState<string>("");
  const [pickAgg, setPickAgg] = useState<string>("sum");

  const selectedCols = new Set(selected.map((m) => m.col + "_" + m.agg));
  const currentDef = available.find((m) => m.col === pickCol);

  const handleAdd = () => {
    if (!pickCol || !pickAgg) return;
    const alias = `${pickCol}_${pickAgg}`;
    onAdd({ col: pickCol, agg: pickAgg, alias });
    setPickCol("");
    setPickAgg("sum");
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mere</div>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {selected.map((m) => {
          const def = available.find((a) => a.col === m.col);
          return (
            <Badge key={m.alias} variant="secondary" className="gap-1 pr-1">
              {def?.label || m.col} ({AGG_LABELS[m.agg] || m.agg})
              <button onClick={() => onRemove(m.alias)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />+
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-2" align="start">
            <Select value={pickCol} onValueChange={(v) => { setPickCol(v); setPickAgg("sum"); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kolona..." /></SelectTrigger>
              <SelectContent>
                {available.map((m) => (
                  <SelectItem key={m.col} value={m.col}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentDef && (
              <Select value={pickAgg} onValueChange={setPickAgg}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentDef.aggs.map((a) => (
                    <SelectItem key={a} value={a}>{AGG_LABELS[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd} disabled={!pickCol}>
              Dodaj
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

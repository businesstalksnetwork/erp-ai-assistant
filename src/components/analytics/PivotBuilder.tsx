import { CubeSelector } from "./CubeSelector";
import { DimensionPicker } from "./DimensionPicker";
import { MeasurePicker } from "./MeasurePicker";
import { FilterPanel } from "./FilterPanel";
import { SavedViewManager } from "./SavedViewManager";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";
import { useCubeMetadata } from "@/hooks/usePivotQuery";
import type { PivotConfig, MeasureConfig } from "@/hooks/usePivotConfig";
import { useEffect } from "react";

interface Props {
  config: PivotConfig;
  onCubeChange: (cube: string) => void;
  onAddRow: (dim: string) => void;
  onRemoveRow: (dim: string) => void;
  onAddMeasure: (m: MeasureConfig) => void;
  onRemoveMeasure: (alias: string) => void;
  onSetFilter: (key: string, values: string[]) => void;
  onClearFilters: () => void;
  onApply: () => void;
  onLoadSaved: (config: Partial<PivotConfig> & { cube: string }) => void;
  isQuerying: boolean;
  onSetRows: (rows: string[]) => void;
  onSetMeasures: (measures: MeasureConfig[]) => void;
}

export function PivotBuilder({
  config, onCubeChange, onAddRow, onRemoveRow,
  onAddMeasure, onRemoveMeasure, onSetFilter, onClearFilters,
  onApply, onLoadSaved, isQuerying, onSetRows, onSetMeasures,
}: Props) {
  const { data: meta, isLoading: metaLoading } = useCubeMetadata(config.cube);

  // Auto-set defaults when cube changes and no rows/measures selected
  useEffect(() => {
    if (!meta) return;
    if (config.rows.length === 0 && meta.default_rows) {
      onSetRows(meta.default_rows);
    }
    if (config.measures.length === 0 && meta.default_measure) {
      onSetMeasures([meta.default_measure]);
    }
  }, [meta, config.cube]);

  if (metaLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const dimensions = meta?.dimensions || [];
  const measures = meta?.measures || [];

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kocka podataka</div>
        <CubeSelector value={config.cube} onChange={onCubeChange} />
      </div>

      <Separator />

      <DimensionPicker
        available={dimensions}
        selected={config.rows}
        onAdd={onAddRow}
        onRemove={onRemoveRow}
        label="Redovi"
      />

      <Separator />

      <MeasurePicker
        available={measures}
        selected={config.measures}
        onAdd={onAddMeasure}
        onRemove={onRemoveMeasure}
      />

      <Separator />

      <FilterPanel
        dimensions={dimensions}
        filters={config.filters}
        onSetFilter={onSetFilter}
        onClear={onClearFilters}
      />

      <Button
        onClick={onApply}
        className="w-full"
        disabled={config.rows.length === 0 || config.measures.length === 0 || isQuerying}
      >
        <Play className="h-4 w-4 mr-2" />
        Primeni
      </Button>

      <Separator />

      <SavedViewManager config={config} onLoad={onLoadSaved} />
    </div>
  );
}

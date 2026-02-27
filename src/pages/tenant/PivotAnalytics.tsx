import { useState, useCallback } from "react";
import { PivotBuilder } from "@/components/analytics/PivotBuilder";
import { PivotTable } from "@/components/analytics/PivotTable";
import { PivotChart } from "@/components/analytics/PivotChart";
import { PivotExport } from "@/components/analytics/PivotExport";
import { usePivotConfig } from "@/hooks/usePivotConfig";
import { usePivotQuery } from "@/hooks/usePivotQuery";
import type { PivotQueryParams } from "@/hooks/usePivotQuery";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Settings2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function PivotAnalytics() {
  const isMobile = useIsMobile();
  const {
    config, setCube, setRows, addRow, removeRow,
    setMeasures, addMeasure, removeMeasure,
    setFilter, clearFilters, setSort, setChartType, setLimit,
    reset, loadFromSaved, toQueryParams,
  } = usePivotConfig();

  const [queryParams, setQueryParams] = useState<PivotQueryParams | null>(null);
  const { data, isLoading, isFetching } = usePivotQuery(queryParams);

  const handleApply = useCallback(() => {
    const p = toQueryParams();
    if (p) setQueryParams(p);
  }, [toQueryParams]);

  const handleLoadMore = useCallback(() => {
    if (!queryParams || !data) return;
    setQueryParams({ ...queryParams, limit: (queryParams.limit || 100) + 100 });
  }, [queryParams, data]);

  const builderContent = (
    <PivotBuilder
      config={config}
      onCubeChange={setCube}
      onAddRow={addRow}
      onRemoveRow={removeRow}
      onAddMeasure={addMeasure}
      onRemoveMeasure={removeMeasure}
      onSetFilter={setFilter}
      onClearFilters={clearFilters}
      onApply={handleApply}
      onLoadSaved={loadFromSaved}
      isQuerying={isLoading || isFetching}
      onSetRows={setRows}
      onSetMeasures={setMeasures}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pivot Analitika</h1>
        <div className="flex items-center gap-2">
          <PivotExport data={data} measures={config.measures} />
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm"><Settings2 className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
                {builderContent}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {!isMobile && (
          <div className="w-64 shrink-0 border rounded-lg bg-card overflow-y-auto max-h-[calc(100vh-12rem)]">
            {builderContent}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-4">
          <PivotChart
            data={data}
            measures={config.measures}
            chartType={config.chartType}
            onChartTypeChange={setChartType}
          />
          <PivotTable
            data={data}
            isLoading={isLoading || isFetching}
            measures={config.measures}
            sortBy={config.sortBy}
            sortDir={config.sortDir}
            onSort={setSort}
            onLoadMore={handleLoadMore}
          />
        </div>
      </div>
    </div>
  );
}

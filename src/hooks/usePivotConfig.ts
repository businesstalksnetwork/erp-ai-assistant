import { useState, useCallback } from "react";

export interface MeasureConfig {
  col: string;
  agg: string;
  alias: string;
}

export interface PivotConfig {
  cube: string;
  rows: string[];
  columns: string[];
  measures: MeasureConfig[];
  filters: Record<string, string[]>;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  chartType: "bar" | "line" | "pie" | null;
  limit: number;
}

const DEFAULT_CONFIG: PivotConfig = {
  cube: "gl_entries",
  rows: [],
  columns: [],
  measures: [],
  filters: {},
  sortBy: null,
  sortDir: "desc",
  chartType: null,
  limit: 100,
};

export function usePivotConfig() {
  const [config, setConfig] = useState<PivotConfig>(DEFAULT_CONFIG);

  const setCube = useCallback((cube: string) => {
    setConfig({ ...DEFAULT_CONFIG, cube });
  }, []);

  const setRows = useCallback((rows: string[]) => {
    setConfig((c) => ({ ...c, rows }));
  }, []);

  const addRow = useCallback((dim: string) => {
    setConfig((c) => c.rows.includes(dim) ? c : { ...c, rows: [...c.rows, dim] });
  }, []);

  const removeRow = useCallback((dim: string) => {
    setConfig((c) => ({ ...c, rows: c.rows.filter((r) => r !== dim) }));
  }, []);

  const setMeasures = useCallback((measures: MeasureConfig[]) => {
    setConfig((c) => ({ ...c, measures }));
  }, []);

  const addMeasure = useCallback((m: MeasureConfig) => {
    setConfig((c) => {
      if (c.measures.some((em) => em.alias === m.alias)) return c;
      return { ...c, measures: [...c.measures, m] };
    });
  }, []);

  const removeMeasure = useCallback((alias: string) => {
    setConfig((c) => ({ ...c, measures: c.measures.filter((m) => m.alias !== alias) }));
  }, []);

  const setFilter = useCallback((key: string, values: string[]) => {
    setConfig((c) => {
      const filters = { ...c.filters };
      if (values.length === 0) {
        delete filters[key];
      } else {
        filters[key] = values;
      }
      return { ...c, filters };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setConfig((c) => ({ ...c, filters: {} }));
  }, []);

  const setSort = useCallback((sortBy: string | null, sortDir?: "asc" | "desc") => {
    setConfig((c) => ({ ...c, sortBy, sortDir: sortDir || c.sortDir }));
  }, []);

  const setChartType = useCallback((chartType: PivotConfig["chartType"]) => {
    setConfig((c) => ({ ...c, chartType }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setConfig((c) => ({ ...c, limit }));
  }, []);

  const reset = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const loadFromSaved = useCallback((savedConfig: Partial<PivotConfig> & { cube: string }) => {
    setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
  }, []);

  const toQueryParams = useCallback(() => {
    if (config.rows.length === 0 || config.measures.length === 0) return null;
    return {
      cube: config.cube,
      rows: config.rows,
      columns: config.columns,
      measures: config.measures,
      filters: config.filters,
      sortBy: config.sortBy,
      sortDir: config.sortDir,
      limit: config.limit,
      offset: 0,
    };
  }, [config]);

  return {
    config,
    setCube,
    setRows,
    addRow,
    removeRow,
    setMeasures,
    addMeasure,
    removeMeasure,
    setFilter,
    clearFilters,
    setSort,
    setChartType,
    setLimit,
    reset,
    loadFromSaved,
    toQueryParams,
  };
}

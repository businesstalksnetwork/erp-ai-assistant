import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { fmtNumAuto } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PivotQueryResult } from "@/hooks/usePivotQuery";
import type { MeasureConfig } from "@/hooks/usePivotConfig";

interface Props {
  data: PivotQueryResult | undefined;
  isLoading: boolean;
  measures: MeasureConfig[];
  sortBy: string | null;
  sortDir: "asc" | "desc";
  onSort: (col: string | null, dir?: "asc" | "desc") => void;
  onLoadMore?: () => void;
}

export function PivotTable({ data, isLoading, measures, sortBy, sortDir, onSort, onLoadMore }: Props) {
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data || data.rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Nema podataka. Izaberite dimenzije i mere, pa kliknite Primeni.</div>;
  }

  const dims = data.dimensions || [];
  const measureAliases = measures.map((m) => m.alias);
  const allCols = [...dims, ...measureAliases];

  // Compute grand totals
  const totals: Record<string, number> = {};
  measureAliases.forEach((alias) => {
    totals[alias] = data.rows.reduce((s, r) => s + (Number(r[alias]) || 0), 0);
  });

  const handleSort = (col: string) => {
    if (sortBy === col) {
      onSort(col, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSort(col, "desc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-2">
      <ScrollArea className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {allCols.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">
                  <button onClick={() => handleSort(col)} className="flex items-center hover:text-foreground transition-colors">
                    {col.replace(/_/g, " ")}
                    <SortIcon col={col} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, i) => (
              <TableRow key={i} className="even:bg-muted/30">
                {allCols.map((col) => (
                  <TableCell key={col} className={`whitespace-nowrap tabular-nums ${measureAliases.includes(col) ? "text-right font-medium" : ""}`}>
                    {measureAliases.includes(col) ? fmtNumAuto(Number(row[col] || 0)) : String(row[col] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {/* Grand total */}
            <TableRow className="bg-muted font-bold border-t-2">
              {allCols.map((col, i) => (
                <TableCell key={col} className={`whitespace-nowrap tabular-nums ${measureAliases.includes(col) ? "text-right" : ""}`}>
                  {i === 0 ? "UKUPNO" : measureAliases.includes(col) ? fmtNumAuto(totals[col]) : ""}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{data.rows.length} od {data.total_count} redova</span>
        {data.rows.length < data.total_count && onLoadMore && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onLoadMore}>Učitaj još</Button>
        )}
      </div>
    </div>
  );
}

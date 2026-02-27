import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { PivotQueryResult } from "@/hooks/usePivotQuery";
import type { MeasureConfig } from "@/hooks/usePivotConfig";

interface Props {
  data: PivotQueryResult | undefined;
  measures: MeasureConfig[];
}

export function PivotExport({ data, measures }: Props) {
  if (!data || data.rows.length === 0) return null;

  const dims = data.dimensions || [];
  const measureAliases = measures.map((m) => m.alias);
  const allCols = [...dims, ...measureAliases];

  const exportCsv = () => {
    const BOM = "\uFEFF";
    const header = allCols.join(",");
    const rows = data.rows.map((r) =>
      allCols.map((c) => {
        const v = r[c];
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    );
    const csv = BOM + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pivot_${data.cube}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data.rows, { header: allCols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pivot");
    XLSX.writeFile(wb, `pivot_${data.cube}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv}>
        <Download className="h-3 w-3 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportXlsx}>
        <Download className="h-3 w-3 mr-1" /> Excel
      </Button>
    </div>
  );
}

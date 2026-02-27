import React, { useState, useMemo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ArrowUp, ArrowDown, ArrowUpDown, Download, Columns3 } from "lucide-react";

export interface ResponsiveColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  primary?: boolean;
  showInCard?: boolean;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Value extractor for sorting (defaults to render output toString) */
  sortValue?: (row: T) => string | number;
  /** If false, column is hidden by default (user can toggle) */
  defaultVisible?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  mobileMode?: "card" | "scroll";
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Enable CSV export button */
  enableExport?: boolean;
  /** Filename for CSV export (without extension) */
  exportFilename?: string;
  /** Enable column visibility toggle */
  enableColumnToggle?: boolean;
  /** Optional footer row(s) rendered inside <tfoot> */
  renderFooter?: () => React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

function exportToCsv<T>(
  data: T[],
  columns: ResponsiveColumn<T>[],
  filename: string
) {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.sortValue ? col.sortValue(row) : col.render(row);
        const str = val == null ? "" : String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );
  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ResponsiveTable<T>({
  data,
  columns,
  mobileMode = "card",
  keyExtractor,
  onRowClick,
  emptyMessage = "Nema podataka",
  enableExport = false,
  exportFilename = "export",
  enableColumnToggle = false,
  renderFooter,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const hidden = new Set<string>();
    columns.forEach((c) => {
      if (c.defaultVisible === false) hidden.add(c.key);
    });
    return hidden;
  });

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const getValue = col.sortValue || ((row: T) => {
      const v = col.render(row);
      return v == null ? "" : String(v);
    });
    return [...data].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSort = useCallback((key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortDir(null);
      setSortKey(null);
    }
  }, [sortKey, sortDir]);

  const toggleCol = useCallback((key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-1 inline" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />;
    return <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  // Toolbar
  const showToolbar = enableExport || enableColumnToggle;

  if (data.length === 0 && !showToolbar) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  // Mobile card mode
  if (isMobile && mobileMode === "card" && data.length > 0) {
    const primaryCol = visibleColumns.find((c) => c.primary);
    const secondaryCols = visibleColumns.filter(
      (c) => !c.primary && c.showInCard !== false
    );

    return (
      <div>
        {showToolbar && (
          <div className="flex justify-end gap-2 mb-2">
            {enableExport && (
              <Button variant="outline" size="sm" onClick={() => exportToCsv(sortedData, visibleColumns, exportFilename)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
            )}
          </div>
        )}
        <div className="space-y-2">
          {sortedData.map((row) => (
            <Card
              key={keyExtractor(row)}
              className={`transition-all hover:shadow-md ${onRowClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent className="p-4">
                {primaryCol && (
                  <div className="font-medium text-sm mb-1.5">
                    {primaryCol.render(row)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {secondaryCols.map((col) => (
                    <div key={col.key} className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {col.label}
                      </span>
                      <span className="text-sm tabular-nums">{col.render(row)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Table mode
  return (
    <div>
      {showToolbar && (
        <div className="flex justify-end gap-2 mb-2">
          {enableColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="h-3.5 w-3.5 mr-1.5" /> Kolone
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenCols.has(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {enableExport && (
            <Button variant="outline" size="sm" onClick={() => exportToCsv(sortedData, visibleColumns, exportFilename)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
          )}
        </div>
      )}
      {data.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className={isMobile && mobileMode === "scroll" ? "overflow-x-auto -mx-4 px-4" : ""}>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns
                  .filter((c) => !(isMobile && c.hideOnMobile))
                  .map((col) => (
                    <TableHead
                      key={col.key}
                      className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow
                  key={keyExtractor(row)}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row)}
                >
                  {visibleColumns
                    .filter((c) => !(isMobile && c.hideOnMobile))
                    .map((col) => (
                      <TableCell
                        key={col.key}
                        className={col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : ""}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                </TableRow>
              ))}
            </TableBody>
            {renderFooter && (
              <TableFooter>
                {renderFooter()}
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </div>
  );
}

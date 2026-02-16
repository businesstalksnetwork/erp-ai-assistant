import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export interface ResponsiveColumn<T> {
  key: string;
  label: string;
  /** Render function for both table cell and card value */
  render: (row: T) => React.ReactNode;
  /** If true, this column is treated as the primary identifier in card mode */
  primary?: boolean;
  /** If true, shown in card mode; defaults to true */
  showInCard?: boolean;
  /** Alignment for table cell */
  align?: "left" | "right" | "center";
  /** If true, column is hidden on smaller screens (only in table mode) */
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  /** "card" = card layout on mobile, "scroll" = horizontal scroll on mobile */
  mobileMode?: "card" | "scroll";
  /** Key extractor for each row */
  keyExtractor: (row: T) => string;
  /** Optional click handler for rows/cards */
  onRowClick?: (row: T) => void;
  /** Optional empty state message */
  emptyMessage?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  mobileMode = "card",
  keyExtractor,
  onRowClick,
  emptyMessage = "Nema podataka",
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  // Mobile card mode
  if (isMobile && mobileMode === "card") {
    const primaryCol = columns.find((c) => c.primary);
    const secondaryCols = columns.filter(
      (c) => !c.primary && c.showInCard !== false
    );

    return (
      <div className="space-y-2">
        {data.map((row) => (
          <Card
            key={keyExtractor(row)}
            className={`transition-all hover:shadow-md ${onRowClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
            onClick={() => onRowClick?.(row)}
          >
            <CardContent className="p-3">
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
    );
  }

  // Table mode (desktop, or mobile scroll)
  return (
    <div className={isMobile && mobileMode === "scroll" ? "overflow-x-auto -mx-4 px-4" : ""}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns
              .filter((c) => !(isMobile && c.hideOnMobile))
              .map((col) => (
                <TableHead
                  key={col.key}
                  className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}
                >
                  {col.label}
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={keyExtractor(row)}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns
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
      </Table>
    </div>
  );
}

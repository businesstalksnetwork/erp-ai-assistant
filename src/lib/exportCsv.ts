export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  formatter?: (value: any, row: T) => string;
}

export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
) {
  if (data.length === 0) return;

  const escape = (val: any): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = typeof col.key === "string" && col.key.includes(".")
          ? col.key.split(".").reduce((o: any, k) => o?.[k], row)
          : row[col.key as keyof T];
        const value = col.formatter ? col.formatter(raw, row) : raw;
        return escape(value);
      })
      .join(",")
  );

  const csv = "\uFEFF" + [header, ...rows].join("\n"); // UTF-8 BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
